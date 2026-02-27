import Foundation

enum ClosetCategory: String, CaseIterable, Identifiable {
    case top
    case bottom
    case outer
    case shoes
    case bag

    var id: String { rawValue }
}

enum SeasonTag: String, CaseIterable, Identifiable {
    case spring
    case summer
    case fall
    case winter

    var id: String { rawValue }
}

enum AppTab: String, CaseIterable, Identifiable {
    case closet
    case lookbook
    case buy
    case profile

    var id: String { rawValue }
}

struct OnboardingProfileDraft {
    var gender: String?
    var heightRange: String?
    var preferredStyles: [String] = []
    var mainSituations: [String] = []
}
