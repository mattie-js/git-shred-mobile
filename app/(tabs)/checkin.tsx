import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useUser } from "../../context/UserContext";
import { submitCheckin, getProgress } from "../../services/api";
import { router } from "expo-router";

export default function CheckinScreen() {
  const { userId, checkinDay } = useUser();
  const [isCheckinDay, setIsCheckinDay] = useState(false);
  const [lastCheckin, setLastCheckin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [avgWeight, setAvgWeight] = useState("");
  const [daysTracked, setDaysTracked] = useState("");
  const [avgSteps, setAvgSteps] = useState("");
  const [strength, setStrength] = useState(2);
  const [fatigue, setFatigue] = useState(5);
  const [daysAdherent, setDaysAdherent] = useState("");
  const [caloriesOver, setCaloriesOver] = useState("");
  const [offTheRails, setOffTheRails] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userId) loadScreen();
  }, [userId]);

  const loadScreen = async () => {
    setLoading(true);
    // checkin_day 6 = Saturday, JS getDay() 6 = Saturday too
    const today = new Date().getDay();
    const checkinDayJS = checkinDay ? checkinDay % 7 : 6;
    setIsCheckinDay(today === checkinDayJS);

    const progress = await getProgress(userId);
    if (progress.history && progress.history.length > 0) {
      setLastCheckin(progress.history[progress.history.length - 1]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!avgWeight || !daysTracked || !avgSteps || !daysAdherent) {
      Alert.alert("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    const result = await submitCheckin({
      user_id: userId,
      avg_weight_lbs: parseFloat(avgWeight),
      days_tracked: parseInt(daysTracked),
      avg_step_count: parseInt(avgSteps),
      strength_subj: strength,
      fatigue_subj: fatigue,
      days_adherent: parseInt(daysAdherent),
      calories_over: caloriesOver ? parseFloat(caloriesOver) : null,
      off_the_rails: offTheRails
    });
    setSubmitting(false);

    if (result.messages) {
      router.push({ pathname: "/checkin-results", params: { messages: JSON.stringify(result.messages), userId }});
    } else {
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  // NOT check-in day — show summary
  if (!isCheckinDay) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>💪 Weekly Check-in</Text>
        <Text style={styles.subtitle}>Check-in day is Saturday</Text>

        {lastCheckin ? (
          <View>
            <Text style={styles.sectionHeader}>Last Check-in</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Date</Text>
              <Text style={styles.cardValue}>{lastCheckin.date}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Weight</Text>
              <Text style={styles.cardValue}>{lastCheckin.weight} lbs</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Weekly Rate of Loss</Text>
              <Text style={styles.cardValue}>{lastCheckin.weekly_rol} lbs</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Days Adherent</Text>
              <Text style={styles.cardValue}>{lastCheckin.days_adherent} / 7</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Avg Steps</Text>
              <Text style={styles.cardValue}>{lastCheckin.avg_step_count}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Fatigue</Text>
              <Text style={styles.cardValue}>{lastCheckin.fatigue} / 10</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Strength</Text>
              <Text style={styles.cardValue}>{lastCheckin.strength === 1 ? "Getting Stronger" : lastCheckin.strength === 2 ? "Maintaining" : "Getting Weaker"}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No check-ins yet. Come back on Saturday to log your first week!</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // IS check-in day — show form
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>💪 Weekly Check-in</Text>
      <Text style={styles.subtitle}>How did this week go?</Text>

      <Text style={styles.label}>Average Weight This Week (lbs)</Text>
      <TextInput style={styles.input} placeholder="e.g. 188.5" placeholderTextColor="#555" value={avgWeight} onChangeText={setAvgWeight} keyboardType="numeric" />

      <Text style={styles.label}>Days You Tracked Weight (1-7)</Text>
      <TextInput style={styles.input} placeholder="e.g. 5" placeholderTextColor="#555" value={daysTracked} onChangeText={setDaysTracked} keyboardType="numeric" />

      <Text style={styles.label}>Average Daily Steps</Text>
      <TextInput style={styles.input} placeholder="e.g. 8000" placeholderTextColor="#555" value={avgSteps} onChangeText={setAvgSteps} keyboardType="numeric" />

      <Text style={styles.label}>Strength This Week</Text>
      {[[1, "Getting Stronger"], [2, "Maintaining"], [3, "Getting Weaker"]].map(([val, label]) => (
        <TouchableOpacity key={val} style={[styles.optionBtn, strength === val && styles.optionBtnActive, { width: "100%", marginBottom: 8 }]} onPress={() => setStrength(val)}>
          <Text style={[styles.optionText, strength === val && styles.optionTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Fatigue This Week (1-10)</Text>
      <View style={styles.row}>
        {[1,2,3,4,5,6,7,8,9,10].map(val => (
          <TouchableOpacity key={val} style={[styles.dayBtn, fatigue === val && styles.optionBtnActive]} onPress={() => setFatigue(val)}>
            <Text style={[styles.optionText, fatigue === val && styles.optionTextActive]}>{val}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Days Adherent to Plan (0-7)</Text>
      <TextInput style={styles.input} placeholder="e.g. 6" placeholderTextColor="#555" value={daysAdherent} onChangeText={setDaysAdherent} keyboardType="numeric" />

      <Text style={styles.label}>Off Plan Days</Text>
      {[[0, "Fully Adherent"], [1, "Know Calories Over"], [2, "Went Off the Rails"]].map(([val, label]) => (
        <TouchableOpacity key={val} style={[styles.optionBtn, offTheRails === val && styles.optionBtnActive, { width: "100%", marginBottom: 8 }]} onPress={() => setOffTheRails(val)}>
          <Text style={[styles.optionText, offTheRails === val && styles.optionTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}

      {offTheRails === 1 && (
        <>
          <Text style={styles.label}>Total Calories Over</Text>
          <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor="#555" value={caloriesOver} onChangeText={setCaloriesOver} keyboardType="numeric" />
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{submitting ? "Submitting..." : "Submit Check-in"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#000" },
  content: { backgroundColor: "#000", padding: 24, paddingTop: 60 },
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff" },
  title: { fontSize: 32, fontWeight: "700", color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#888", marginBottom: 32 },
  sectionHeader: { color: "#888", fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" },
  card: { backgroundColor: "#111", borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  cardLabel: { color: "#888", fontSize: 14 },
  cardValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emptyCard: { backgroundColor: "#111", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { color: "#888", fontSize: 14, textAlign: "center", lineHeight: 22 },
  label: { alignSelf: "flex-start", fontSize: 14, fontWeight: "600", color: "#888", marginBottom: 6, marginTop: 12 },
  input: { width: "100%", backgroundColor: "#111", borderWidth: 1, borderColor: "#333", borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 4, color: "#fff" },
  row: { flexDirection: "row", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  optionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: "#333", backgroundColor: "#111" },
  optionBtnActive: { backgroundColor: "#2D5016", borderColor: "#2D5016" },
  optionText: { color: "#888", fontWeight: "500" },
  optionTextActive: { color: "white" },
  dayBtn: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: "#333", backgroundColor: "#111" },
  button: { width: "100%", backgroundColor: "#2D5016", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 32, marginBottom: 40 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" }
});
