import SwiftUI

struct LookbookView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                PlaceholderCard(
                    title: "Lookbook",
                    message: "Outfit board with Top, Bottom, Outer, Shoes, and optional Bag slots."
                )
                PlaceholderCard(
                    title: "Slot Picker",
                    message: "Slot selection and filtered closet picker are placeholders in this phase."
                )
            }
            .padding()
            .navigationTitle("Lookbook")
        }
    }
}

#Preview {
    LookbookView()
}
