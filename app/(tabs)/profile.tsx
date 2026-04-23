import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useUser } from "../../context/UserContext";
import { getProgress, getTrainingTemplate, saveTrainingTemplate } from "../../services/api";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const defaultSchedule = () => {
  const s = {};
  DAYS.forEach(day => s[day] = { isTraining: false, session: "" });
  return s;
};

export default function ProfileScreen() {
  const { userId, plan, startingWeight } = useUser();
  const [currentWeight, setCurrentWeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [schedule, setSchedule] = useState(defaultSchedule());

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const progress = await getProgress(userId);
    if (progress.history && progress.history.length > 0) {
      setCurrentWeight(progress.history[progress.history.length - 1].weight);
    } else {
      setCurrentWeight(startingWeight);
    }

    const template = await getTrainingTemplate(userId);
    if (template && !template.detail) {
      const rebuilt = defaultSchedule();
      DAYS.forEach(day => {
        if (template.schedule[day] && template.schedule[day] !== "Rest") {
          rebuilt[day] = { isTraining: true, session: template.schedule[day] };
        }
      });
      setSchedule(rebuilt);
    }
    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    const formatted = {};
    DAYS.forEach(day => {
      formatted[day] = schedule[day].isTraining ? schedule[day].session || "Training" : "Rest";
    });
    await saveTrainingTemplate(userId, formatted);
    setShowTemplateModal(false);
  };

  const toggleDay = (day) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], isTraining: !prev[day].isTraining, session: "" }
    }));
  };

  const setSession = (day, text) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], session: text }
    }));
  };

  const estimatedWeeks = () => {
    if (!plan || !currentWeight) return null;
    if (plan.weeks_to_goal > 0) return plan.weeks_to_goal;
    const lbsToLose = currentWeight - plan.goal_weight;
    const lbsPerWeek = currentWeight * (plan.rate_of_loss_pct / 100);
    return Math.round(lbsToLose / lbsPerWeek);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  const weeks = estimatedWeeks();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.screenTitle}>Profile</Text>

        <Text style={styles.currentWeight}>
          {currentWeight ? `${currentWeight} lbs` : "—"}
        </Text>
        <Text style={styles.subStat}>
          Goal: {plan?.goal_weight} lbs
        </Text>
        <Text style={styles.subStat}>
          {weeks > 0 ? `~${weeks} weeks remaining` : "No end date set"}
        </Text>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.button} onPress={() => setShowPlanModal(true)}>
          <Text style={styles.buttonText}>View Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => setShowTemplateModal(true)}>
          <Text style={styles.buttonText}>Edit Training Split</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Plan Modal */}
      <Modal visible={showPlanModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Your Current Plan</Text>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Daily Calories</Text>
              <Text style={styles.planValue}>{plan?.cal_rx} kcal</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Protein</Text>
              <Text style={styles.planValue}>{plan?.protein_rx}g</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Carbs</Text>
              <Text style={styles.planValue}>{plan?.carb_rx}g</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Fat</Text>
              <Text style={styles.planValue}>{plan?.fat_rx}g</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>TDEE</Text>
              <Text style={styles.planValue}>{plan?.tdee} kcal</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Rate of Loss</Text>
              <Text style={styles.planValue}>{plan?.rate_of_loss_pct}% BW/week</Text>
            </View>
            <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowPlanModal(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Training Split Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Training Split</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {DAYS.map(day => (
                  <View key={day} style={styles.dayRow}>
                    <TouchableOpacity style={styles.dayToggle} onPress={() => toggleDay(day)}>
                      <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                      <Text style={[styles.dayStatus, schedule[day].isTraining && styles.dayStatusActive]}>
                        {schedule[day].isTraining ? "Training ✓" : "Rest"}
                      </Text>
                    </TouchableOpacity>
                    {schedule[day].isTraining && (
                      <TextInput
                        style={styles.sessionInput}
                        placeholder="e.g. Push, Pull, Legs"
                        placeholderTextColor="#555"
                        value={schedule[day].session}
                        onChangeText={(text) => setSession(day, text)}
                      />
                    )}
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTemplate}>
                <Text style={styles.saveButtonText}>Save Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#000" },
  content: { padding: 24, paddingTop: 60 },
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff" },
  screenTitle: { color: "#888", fontSize: 14, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 },
  currentWeight: { color: "#fff", fontSize: 64, fontWeight: "800", marginBottom: 8 },
  subStat: { color: "#888", fontSize: 16, marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#222", marginVertical: 32 },
  button: { backgroundColor: "#111", borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#333" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "85%" },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 20 },
  planRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#222" },
  planLabel: { color: "#888", fontSize: 15 },
  planValue: { color: "#fff", fontSize: 15, fontWeight: "600" },
  closeModalButton: { backgroundColor: "#2D5016", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  closeModalText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dayRow: { marginBottom: 16 },
  dayToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", borderRadius: 10, padding: 14 },
  dayName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  dayStatus: { color: "#666", fontSize: 14 },
  dayStatusActive: { color: "#4caf50", fontWeight: "600" },
  sessionInput: { backgroundColor: "#0a0a0a", borderRadius: 8, padding: 12, color: "#fff", marginTop: 8, borderWidth: 1, borderColor: "#333" },
  saveButton: { backgroundColor: "#2D5016", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" }
});