import Foundation

enum ClosetAPIClientError: LocalizedError {
    case invalidEndpoint
    case invalidResponse
    case serverError(code: String, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint:
            return "Invalid closet endpoint URL."
        case .invalidResponse:
            return "Invalid closet response."
        case let .serverError(code, message):
            return "\(code): \(message)"
        }
    }
}

struct ClosetItemDTO: Decodable, Identifiable {
    let id: String
    let status: String
    let previewPath: String
    let previewSignedURL: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case previewPath = "preview_path"
        case previewSignedURL = "preview_signed_url"
        case createdAt = "created_at"
    }
}

private struct ClosetItemsResponseEnvelope: Decodable {
    let items: [ClosetItemDTO]
}

private struct ClosetErrorEnvelope: Decodable {
    struct EdgeError: Decodable {
        let code: String
        let message: String
    }

    let error: EdgeError
}

struct ClosetAPIClient {
    let endpoint: URL
    let bearerToken: String?
    var session: URLSession = .shared

    init(extractionsEndpointString: String, bearerToken: String?) throws {
        guard var components = URLComponents(string: extractionsEndpointString) else {
            throw ClosetAPIClientError.invalidEndpoint
        }
        var path = components.path
        if path.hasSuffix("/") {
            path.removeLast()
        }
        components.path = "\(path)/closet-items"
        guard let finalURL = components.url else {
            throw ClosetAPIClientError.invalidEndpoint
        }
        endpoint = finalURL
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

    func fetchClosetItems() async throws -> [ClosetItemDTO] {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "GET"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let authorizationValue = buildAuthorizationValue() {
            request.setValue(authorizationValue, forHTTPHeaderField: "Authorization")
        } else {
            request.setValue(nil, forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ClosetAPIClientError.invalidResponse
        }

        if (200 ..< 300).contains(httpResponse.statusCode) {
            let payload = try JSONDecoder().decode(ClosetItemsResponseEnvelope.self, from: data)
            return payload.items
        }

        if let edgeError = try? JSONDecoder().decode(ClosetErrorEnvelope.self, from: data) {
            throw ClosetAPIClientError.serverError(
                code: edgeError.error.code,
                message: edgeError.error.message
            )
        }
        throw ClosetAPIClientError.invalidResponse
    }
}
