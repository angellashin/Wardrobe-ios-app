//
//  WardrobeAppApp.swift
//  WardrobeApp
//
//  Created by 신민서 on 2/10/26.
//

import SwiftUI

@main
struct WardrobeAppApp: App {
    @StateObject private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(router)
        }
    }
}
