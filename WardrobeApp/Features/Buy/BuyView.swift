import SwiftUI

struct BuyView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                PlaceholderCard(
                    title: "Should I Buy It?",
                    message: "Candidate item registration and compatibility filtering flow placeholder."
                )
                PlaceholderCard(
                    title: "Comparison Outfit",
                    message: "Visual outfit combinations for candidate checks will be connected in Phase 2."
                )
            }
            .padding()
            .navigationTitle("Buy")
        }
    }
}

#Preview {
    BuyView()
}
