import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        VStack(spacing: 16) {
            PlaceholderCard(
                title: "Onboarding",
                message: "Collect optional gender/height, preferred styles (up to 3), and main situations (1-2)."
            )
            Button("Complete Onboarding (Placeholder)") {
                router.completeOnboarding()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .navigationTitle("Onboarding")
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AppRouter())
}
