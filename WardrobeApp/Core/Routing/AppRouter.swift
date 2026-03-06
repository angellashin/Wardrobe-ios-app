import Foundation
import Combine

final class AppRouter: ObservableObject {
    @Published var isAuthenticated = false
    @Published var hasCompletedOnboarding = false
    @Published var selectedTab: AppTab = .closet
    @Published var onboardingDraft = OnboardingProfileDraft()

    func completeOnboarding() {
        hasCompletedOnboarding = true
    }
}
