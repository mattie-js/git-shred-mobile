import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Git Shred", headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ title: "Menu" }} />
      <Stack.Screen name="create-plan" options={{ title: "Create Plan" }} />
      <Stack.Screen name="plan-created" options={{ title: "Your Plan" }} />
      <Stack.Screen name="checkin" options={{ title: "Weekly Check-In" }} />
      <Stack.Screen name="checkin-results" options={{ title: "Recommendation" }} />
    </Stack>
  );
}