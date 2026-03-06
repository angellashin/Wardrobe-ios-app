import Foundation

enum ExtractionsAPIClientError: LocalizedError {
    case invalidEndpoint
    case invalidResponse
    case decodingFailed(message: String)
    case requestFailed(message: String)
    case serverError(code: String, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint:
            return "Invalid extractions endpoint URL."
        case .invalidResponse:
            return "Invalid server response."
        case let .decodingFailed(message):
            return "Failed to decode response: \(message)"
        case let .requestFailed(message):
            return message
        case let .serverError(code, message):
            return "\(code): \(message)"
        }
    }
}

struct ExtractionCreateResponse: Decodable {
    struct Assets: Decodable {
        let originalPath: String
        let cutoutPath: String
        let previewPath: String
        let originalSignedURL: String?
        let cutoutSignedURL: String?
        let previewSignedURL: String?

        enum CodingKeys: String, CodingKey {
            case originalPath = "original_path"
            case cutoutPath = "cutout_path"
            case previewPath = "preview_path"
            case originalSignedURL = "original_signed_url"
            case cutoutSignedURL = "cutout_signed_url"
            case previewSignedURL = "preview_signed_url"
        }
    }

    let extractionID: String
    let itemID: String
    let status: String
    let targetKind: String
    let assets: Assets

    enum CodingKeys: String, CodingKey {
        case extractionID = "extraction_id"
        case itemID = "item_id"
        case status
        case targetKind = "target_kind"
        case assets
    }
}

private struct ExtractionCreateRequestPayload: Encodable {
    let target_kind: String
    let tap_x: Double
    let tap_y: Double
    let image_base64: String
    let image_mime_type: String
    let image_file_name: String
    let client_request_id: String
}

private struct ExtractionErrorEnvelope: Decodable {
    struct EdgeError: Decodable {
        let code: String
        let message: String
    }

    let error: EdgeError
}

struct ExtractionsAPIClient {
    let endpoint: URL
    let bearerToken: String?
    var session: URLSession = .shared

    init(endpointString: String, bearerToken: String?) throws {
        guard let endpointURL = URL(string: endpointString) else {
            throw ExtractionsAPIClientError.invalidEndpoint
        }
        endpoint = endpointURL
        self.bearerToken = bearerToken?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func buildAuthorizationValue() -> String? {
        guard let token = bearerToken, !token.isEmpty else {
            return nil
        }
        if token.hasPrefix("Bearer ") {
            return token
        }
        return "Bearer \(token)"
    }

    func createExtraction(
        imageData: Data,
        targetKind: String,
        tapX: Double,
        tapY: Double
    ) async throws -> ExtractionCreateResponse {
        print("ExtractionAPI START endpoint=\(endpoint.absoluteString) imageBytes=\(imageData.count) tap=(\(tapX),\(tapY))")
        let payload = ExtractionCreateRequestPayload(
            target_kind: targetKind,
            tap_x: tapX,
            tap_y: tapY,
            image_base64: imageData.base64EncodedString(),
            image_mime_type: "image/jpeg",
            image_file_name: "ios-upload.jpg",
            client_request_id: UUID().uuidString
        )

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let authorizationValue = buildAuthorizationValue() {
            request.setValue(authorizationValue, forHTTPHeaderField: "Authorization")
        } else {
            request.setValue(nil, forHTTPHeaderField: "Authorization")
        }
        print("Extraction request headers:", request.allHTTPHeaderFields ?? [:])
        request.httpBody = try JSONEncoder().encode(payload)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
            print("ExtractionAPI RESPONSE received bytes=\(data.count)")
        } catch {
            let message = error.localizedDescription.isEmpty
                ? "Extraction request failed. Check endpoint and local Supabase status."
                : error.localizedDescription
            print("ExtractionAPI NETWORK ERROR:", message)
            throw ExtractionsAPIClientError.requestFailed(message: message)
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            print("ExtractionAPI INVALID RESPONSE TYPE")
            throw ExtractionsAPIClientError.invalidResponse
        }
        print("ExtractionAPI STATUS:", httpResponse.statusCode)
        if let rawBody = String(data: data, encoding: .utf8) {
            print("ExtractionAPI RAW BODY:", rawBody)
        } else {
            print("ExtractionAPI RAW BODY: <non-utf8>")
        }

        if (200 ..< 300).contains(httpResponse.statusCode) {
            do {
                return try JSONDecoder().decode(ExtractionCreateResponse.self, from: data)
            } catch {
                print("ExtractionAPI DECODE ERROR:", error.localizedDescription)
                throw ExtractionsAPIClientError.decodingFailed(message: error.localizedDescription)
            }
        }

        if let edgeError = try? JSONDecoder().decode(ExtractionErrorEnvelope.self, from: data) {
            throw ExtractionsAPIClientError.serverError(
                code: edgeError.error.code,
                message: edgeError.error.message
            )
        }
        throw ExtractionsAPIClientError.invalidResponse
    }
}
