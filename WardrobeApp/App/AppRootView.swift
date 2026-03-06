import SwiftUI

struct AppRootView: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Group {
            if !router.isAuthenticated {
                AuthGatePlaceholderView()
            } else if !router.hasCompletedOnboarding {
                OnboardingView()
            } else {
                MainTabShellView()
            }
        }
    }
}

private struct AuthGatePlaceholderView: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        VStack(spacing: 16) {
            PlaceholderCard(
                title: "AuthGate",
                message: "Authentication flow placeholder. Phase 2 wires Supabase Auth."
            )
            Button("Continue (Placeholder Login)") {
                router.isAuthenticated = true
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

private struct MainTabShellView: View {
    var body: some View {
        TabView {
            ClosetView()
                .tabItem {
                    Label("Closet", systemImage: "square.grid.2x2")
                }

            LookbookView()
                .tabItem {
                    Label("Lookbook", systemImage: "rectangle.stack")
                }

            BuyView()
                .tabItem {
                    Label("Buy", systemImage: "bag")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person")
                }
        }
    }
}

#Preview {
    AppRootView()
        .environmentObject(AppRouter())
}
