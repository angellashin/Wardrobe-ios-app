import PhotosUI
import SwiftUI
import UIKit

struct ExtractionView: View {
    let onSuccess: (() -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedImageData: Data?
    @State private var selectedUIImage: UIImage?

    @AppStorage("extractions.endpoint")
    private var endpoint = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/extractions"
    @AppStorage("extractions.bearer_token")
    private var bearerToken = ""
    @State private var tapX = 0.5
    @State private var tapY = 0.5

    @State private var isSubmitting = false
    @State private var result: ExtractionCreateResponse?
    @State private var errorMessage: String?
#if DEBUG
    @State private var showDebugDetails = false
#endif

    init(onSuccess: (() -> Void)? = nil) {
        self.onSuccess = onSuccess
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PlaceholderCard(
                    title: "Extraction",
                    message: "Pick an image, adjust tap coordinates, and call POST /edge/extractions."
                )

                PhotosPicker("Pick Image", selection: $selectedPhoto, matching: .images)
                    .buttonStyle(.borderedProminent)

                if let image = selectedUIImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                TextField("Edge Endpoint URL", text: $endpoint)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .textFieldStyle(.roundedBorder)

                TextField("Bearer Token (required when auth is enabled)", text: $bearerToken)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .textFieldStyle(.roundedBorder)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Tap X: \(tapX, specifier: "%.2f")")
                    Slider(value: $tapX, in: 0 ... 1)
                    Text("Tap Y: \(tapY, specifier: "%.2f")")
                    Slider(value: $tapY, in: 0 ... 1)
                }

                Button(isSubmitting ? "Sending..." : "Run Extraction") {
                    Task {
                        await runExtraction()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting || selectedImageData == nil)

                if let response = result {
                    if let previewURL = remotePreviewURL(from: response) {
                        AsyncImage(url: previewURL) { phase in
                            switch phase {
                            case .empty:
                                ProgressView()
                            case let .success(image):
                                image
                                    .resizable()
                                    .scaledToFit()
                            case .failure:
                                Text("Preview image could not be loaded.")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .onAppear {
                                        print("ExtractionView preview fetch failed for URL:", previewURL.absoluteString)
                                    }
                            @unknown default:
                                EmptyView()
                            }
                        }
                        .frame(maxHeight: 220)
                    } else if let selectedUIImage {
                        PlaceholderCard(
                            title: "Preview Fallback",
                            message: "No HTTP preview URL was returned (common in local mock mode). Showing selected image."
                        )
                        Image(uiImage: selectedUIImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    PlaceholderCard(
                        title: "Result",
                        message: "Item saved as draft. Confirm tags to activate."
                    )

                    HStack(spacing: 12) {
                        Button("Confirm tags") {
                            dismiss()
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Back to Closet") {
                            dismiss()
                        }
                        .buttonStyle(.bordered)
                    }

#if DEBUG
                    Button(showDebugDetails ? "Hide Debug Details" : "Show Debug Details") {
                        showDebugDetails.toggle()
                    }
                    .buttonStyle(.bordered)

                    if showDebugDetails {
                        Text(response.assets.previewSignedURL ?? response.assets.previewPath)
                            .font(.footnote)
                            .textSelection(.enabled)
                    }
#endif
                }

                if let message = errorMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .padding()
        }
        .navigationTitle("Extraction")
        .onChange(of: selectedPhoto) {
            guard let selectedPhoto else { return }
            Task {
                await loadImage(from: selectedPhoto)
            }
        }
    }

    @MainActor
    private func loadImage(from pickerItem: PhotosPickerItem) async {
        errorMessage = nil
        guard let data = try? await pickerItem.loadTransferable(type: Data.self) else {
            errorMessage = "Failed to load image data."
            return
        }
        selectedImageData = data
        selectedUIImage = UIImage(data: data)
    }

    @MainActor
    private func runExtraction() async {
        guard let imageData = selectedImageData else {
            errorMessage = "Select an image first."
            return
        }

        print("ExtractionView RUN start")
        errorMessage = nil
        isSubmitting = true
        defer {
            isSubmitting = false
            print("ExtractionView RUN end isSubmitting=\(isSubmitting)")
        }

        do {
            print("ExtractionView token is empty:", bearerToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            let client = try ExtractionsAPIClient(endpointString: endpoint, bearerToken: bearerToken)
            result = try await client.createExtraction(
                imageData: imageData,
                targetKind: "closet",
                tapX: tapX,
                tapY: tapY
            )
            onSuccess?()
        } catch {
            result = nil
            let message = error.localizedDescription
            errorMessage = message.isEmpty
                ? "Extraction failed. Check endpoint, token, and local Supabase status."
                : message
        }
    }

    private func remotePreviewURL(from response: ExtractionCreateResponse) -> URL? {
        let rawValue = response.assets.previewSignedURL ?? response.assets.previewPath
        guard let url = URL(string: rawValue), let scheme = url.scheme else {
            return nil
        }
        if scheme == "http" || scheme == "https" {
            return url
        }
        return nil
    }
}

#Preview {
    NavigationStack {
        ExtractionView(onSuccess: nil)
    }
}
