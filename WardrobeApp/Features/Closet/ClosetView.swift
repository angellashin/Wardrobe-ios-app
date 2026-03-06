import SwiftUI

struct ClosetView: View {
    @AppStorage("extractions.endpoint")
    private var endpoint = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/extractions"
    @AppStorage("extractions.bearer_token")
    private var bearerToken = ""

    @State private var items: [ClosetItemDTO] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    NavigationLink("Open Extraction Demo") {
                        ExtractionView {
                            Task {
                                await loadClosetItems()
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)

                    if isLoading {
                        ProgressView("Loading closet...")
                    } else if let message = errorMessage {
                        PlaceholderCard(
                            title: "Closet Load Failed",
                            message: message
                        )
                    } else if items.isEmpty {
                        PlaceholderCard(
                            title: "Closet Empty",
                            message: "No extracted items yet. Run extraction to add your first item."
                        )
                    } else {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(items) { item in
                                VStack(alignment: .leading, spacing: 8) {
                                    if let previewURL = URL(string: item.previewSignedURL ?? "") {
                                        AsyncImage(url: previewURL) { phase in
                                            switch phase {
                                            case .empty:
                                                ProgressView()
                                                    .frame(maxWidth: .infinity, minHeight: 120)
                                            case let .success(image):
                                                image
                                                    .resizable()
                                                    .scaledToFill()
                                                    .frame(height: 140)
                                                    .clipped()
                                            case .failure:
                                                Color.gray.opacity(0.15)
                                                    .overlay(
                                                        Text("Image unavailable")
                                                            .font(.caption)
                                                            .foregroundStyle(.secondary)
                                                    )
                                                    .frame(height: 140)
                                            @unknown default:
                                                EmptyView()
                                            }
                                        }
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                    } else {
                                        Color.gray.opacity(0.15)
                                            .overlay(
                                                Text("No preview URL")
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                            )
                                            .frame(height: 140)
                                            .clipShape(RoundedRectangle(cornerRadius: 10))
                                    }

                                    Text(item.status.capitalized)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Closet")
            .task {
                await loadClosetItems()
            }
        }
    }

    @MainActor
    private func loadClosetItems() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let client = try ClosetAPIClient(
                extractionsEndpointString: endpoint,
                bearerToken: bearerToken
            )
            items = try await client.fetchClosetItems()
        } catch {
            items = []
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    ClosetView()
}
