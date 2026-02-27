import SwiftUI

struct ProfileView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                PlaceholderCard(
                    title: "Profile",
                    message: "Placeholder for onboarding preferences, account settings, and privacy controls."
                )
            }
            .padding()
            .navigationTitle("Profile")
        }
    }
}

#Preview {
    ProfileView()
}
