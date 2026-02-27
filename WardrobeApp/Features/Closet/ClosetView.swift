import SwiftUI

struct ClosetView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                PlaceholderCard(
                    title: "Closet",
                    message: "Placeholder for item grid/list, filters, and extraction entry."
                )
                PlaceholderCard(
                    title: "Filters",
                    message: "Category, type, season, warmth, and color filtering will be wired in Phase 2."
                )
            }
            .padding()
            .navigationTitle("Closet")
        }
    }
}

#Preview {
    ClosetView()
}
