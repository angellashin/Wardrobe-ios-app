//
//  ContentView.swift
//  WardrobeApp
//
//  Created by 신민서 on 2/10/26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        AppRootView()
            .environmentObject(AppRouter())
    }
}

#Preview {
    ContentView()
}
