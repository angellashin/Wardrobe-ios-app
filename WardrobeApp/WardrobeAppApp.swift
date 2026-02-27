//
//  WardrobeAppApp.swift
//  WardrobeApp
//
//  Created by 신민서 on 2/10/26.
//

import SwiftUI

@main
struct WardrobeAppApp: App {
    private let delegatedApp = WardrobeInMyPhoneApp()

    var body: some Scene {
        delegatedApp.body
    }
}
