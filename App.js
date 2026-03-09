import React, { useEffect } from "react";
import { StatusBar, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";

import HomeScreen from "./screens/HomeScreen";
import ChatRoomScreen from "./screens/ChatRoomScreen";

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Request notification permissions on app start
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Notification permissions not granted");
      }
    })();

    // Disable zooming in mobile browsers (esp Safari)
    if (Platform.OS === "web") {
      const disableZoom = (e) => {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      };

      document.addEventListener("touchstart", disableZoom, { passive: false });
      document.addEventListener("gesturestart", (e) => e.preventDefault());

      // Fix for double-tap to zoom
      let lastTouchEnd = 0;
      document.addEventListener("touchend", (e) => {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);

      // CSS to prevent zoom on focus and double tap
      const style = document.createElement("style");
      style.textContent = `
        * {
          touch-action: pan-x pan-y;
          -webkit-text-size-adjust: 100%;
        }
        input, textarea, select {
          font-size: 16px !important; /* Prevents auto-zoom on focus in iOS */
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0f0f1a" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
