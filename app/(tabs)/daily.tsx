import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useUser } from "../../context/UserContext";
import { getSupplementTemplate, getTodayLog, getTrainingTemplate, saveSupplementTemplate, saveTrainingTemplate, updateDailyLog } from "../../services/api";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const defaultSchedule = () => {
  const s = {};
  DAYS.forEach(day => s[day] = { isTraining: false, session: "" });
  return s;
};

export default function DailyScreen() {
  const { userId } = useUser();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dayClosed, setDayClosed] = useState(false);
  const [bodyweightInput, setBodyweightInput] = useState("");

  const [trainingComplete, setTrainingComplete] = useState(false);
  const [nutritionComplete, setNutritionComplete] = useState(false);
  const [cardioComplete, setCardioComplete] = useState(false);
  const [supplementsComplete, setSupplementsComplete] = useState(false);
  const [notes, setNotes] = useState("");

  const [stepCountInput, setStepCountInput] = useState("");
  const [cardioMinutesInput, setCardioMinutesInput] = useState("");

  const [supplements, setSupplements] = useState([]);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [newSuppInput, setNewSuppInput] = useState("");
  const [suppList, setSuppList] = useState([]);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [schedule, setSchedule] = useState(defaultSchedule());

  useEffect(() => {
    if (userId) loadScreen();
  }, [userId]);

  const loadScreen = async () => {
    setLoading(true);
    setDayClosed(false);

    const template = await getTrainingTemplate(userId);
    if (!template || template.detail === "No training template found") {
      setShowTemplateModal(true);
    }

    const suppTemplate = await getSupplementTemplate(userId);
    if (suppTemplate && suppTemplate.supplements) {
      setSupplements(suppTemplate.supplements);
    } else {
      setShowSupplementModal(true);
    }

    const data = await getTodayLog(userId);
    setLog(data);
    if (data.status === "completed") {
      setDayClosed(true);
      setTrainingComplete(data.training_complete || false);
      setNutritionComplete(data.nutrition_complete || false);
      setCardioComplete(data.cardio_complete || false);
      setSupplementsComplete(data.supplements_complete || false);
      setStepCountInput(data.step_count != null ? String(data.step_count) : "");
      setCardioMinutesInput(data.cardio_minutes != null ? String(data.cardio_minutes) : "");
      setBodyweightInput(data.bodyweight_lbs != null ? String(data.bodyweight_lbs) : "");
    }

    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    const formatted = {};
    DAYS.forEach(day => {
      formatted[day] = schedule[day].isTraining ? schedule[day].session || "Training" : "Rest";
    });
    await saveTrainingTemplate(userId, formatted);

    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const todaySession = formatted[todayName];

    if (log) {
      await updateDailyLog(log.id, { training_session: todaySession });
    }

    setShowTemplateModal(false);
    setDayClosed(false);
    await loadScreen();
  };

  const handleSaveSupplements = async () => {
    await saveSupplementTemplate(userId, suppList);
    setSupplements(suppList);
    setShowSupplementModal(false);
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

  const handleCloseDay = async () => {
    const allComplete = trainingComplete && nutritionComplete && cardioComplete && supplementsComplete;

    const perfectMessages = [
      "All boxes checked. You're a machine! 🔥",
      "Perfect day. This is what separates you from the rest.",
      "Every box checked. That's a locked in athlete right there.",
      "Full send today. Keep that energy tomorrow.",
      "That's what discipline looks like. Well done."
    ];

    const partialMessages = [
      "Keep it up. Tomorrow is another shot.",
      "Progress over perfection. You showed up.",
      "Not perfect, but you tracked it. That matters.",
      "One day at a time. Come back stronger tomorrow.",
      "Consistency beats intensity. Keep going."
    ];

    const messages = allComplete ? perfectMessages : partialMessages;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    const result = await updateDailyLog(log.id, {
      training_complete: trainingComplete,
      nutrition_complete: nutritionComplete,
      cardio_complete: cardioComplete,
      supplements_complete: supplementsComplete,
      is_adherent: allComplete,
      notes: notes,
      status: "completed",
      step_count: stepCountInput !== "" ? parseInt(stepCountInput, 10) : null,
      cardio_minutes: cardioMinutesInput !== "" ? parseInt(cardioMinutesInput, 10) : null,
      bodyweight_lbs: bodyweightInput !== "" ? parseFloat(bodyweightInput) : null,
    });

    if (result.status === "completed") {
      setDayClosed(true);
      Alert.alert(
        allComplete ? "Perfect Day! 🔥" : "Day Logged 💪",
        randomMessage
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading your day...</Text>
      </View>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.date}>{today}</Text>
        <Text style={styles.session}>
          {log?.training_session && log.training_session !== "Rest"
            ? `💪 ${log.training_session} Day`
            : "😴 Rest Day"}
        </Text>

        {dayClosed && (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>✅ Day Complete</Text>
          </View>
        )}

        <Text style={styles.sectionHeader}>Today's Checklist</Text>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Today's weight (lbs)</Text>
          <TextInput
            style={[styles.metricInput, dayClosed && styles.metricInputDisabled]}
            placeholder="e.g. 183.5"
            placeholderTextColor="#444"
            keyboardType="decimal-pad"
            value={bodyweightInput}
            onChangeText={setBodyweightInput}
            editable={!dayClosed}
            maxLength={6}
          />
        </View>

        <TouchableOpacity style={styles.checkRow} onPress={() => !dayClosed && setTrainingComplete(!trainingComplete)}>
          <Text style={styles.checkbox}>{trainingComplete ? "✅" : "⬜"}</Text>
          <Text style={styles.checkLabel}>Training session completed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => !dayClosed && setNutritionComplete(!nutritionComplete)}>
          <Text style={styles.checkbox}>{nutritionComplete ? "✅" : "⬜"}</Text>
          <Text style={styles.checkLabel}>Hit nutrition targets</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => !dayClosed && setCardioComplete(!cardioComplete)}>
          <Text style={styles.checkbox}>{cardioComplete ? "✅" : "⬜"}</Text>
          <Text style={styles.checkLabel}>Cardio & steps</Text>
        </TouchableOpacity>

        {(cardioComplete || cardioMinutesInput !== "" || stepCountInput !== "") && (
          <View style={{ marginTop: -12, marginBottom: 20, marginLeft: 36 }}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Cardio minutes</Text>
              <TextInput
                style={[styles.metricInput, dayClosed && styles.metricInputDisabled]}
                placeholder="e.g. 45"
                placeholderTextColor="#444"
                keyboardType="numeric"
                value={cardioMinutesInput}
                onChangeText={setCardioMinutesInput}
                editable={!dayClosed}
                maxLength={4}
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Step count</Text>
              <TextInput
                style={[styles.metricInput, dayClosed && styles.metricInputDisabled]}
                placeholder="e.g. 10000"
                placeholderTextColor="#444"
                keyboardType="numeric"
                value={stepCountInput}
                onChangeText={setStepCountInput}
                editable={!dayClosed}
                maxLength={6}
              />
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.checkRow} onPress={() => !dayClosed && setSupplementsComplete(!supplementsComplete)}>
          <Text style={styles.checkbox}>{supplementsComplete ? "✅" : "⬜"}</Text>
          <Text style={styles.checkLabel}>Supplements taken</Text>
        </TouchableOpacity>

        {supplementsComplete && supplements.length > 0 && (
          <View style={{ marginTop: -12, marginBottom: 20, marginLeft: 36 }}>
            {supplements.map((supp, i) => (
              <Text key={i} style={{ color: "#666", fontSize: 14, marginBottom: 4 }}>· {supp}</Text>
            ))}
          </View>
        )}

        <Text style={styles.targets}>
          🎯 Targets: {log?.target_calories} kcal · {log?.target_protein}g protein
        </Text>

        <TouchableOpacity
          style={[styles.closeButton, dayClosed && styles.closeButtonDone]}
          onPress={!dayClosed ? handleCloseDay : undefined}
        >
          <Text style={styles.closeButtonText}>
            {dayClosed ? "✓ Day Closed" : "Close the Day"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Training Template Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Set Up Your Training Split</Text>
              <Text style={styles.modalSubtitle}>Tap a day to toggle training or rest, then name the session.</Text>
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
                        placeholder="Session name e.g. Push, Pull, Legs"
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

      {/* Supplement Template Modal */}
      <Modal visible={showSupplementModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Your Supplement Stack</Text>
              <Text style={styles.modalSubtitle}>Add the supplements you take daily. They'll show as a reminder when you check in.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                <TextInput
                  style={[styles.sessionInput, { flex: 1, marginTop: 0 }]}
                  placeholder="e.g. Creatine, Fish Oil..."
                  placeholderTextColor="#555"
                  value={newSuppInput}
                  onChangeText={setNewSuppInput}
                />
                <TouchableOpacity
                  style={[styles.saveButton, { paddingHorizontal: 16, marginTop: 0 }]}
                  onPress={() => {
                    if (newSuppInput.trim()) {
                      setSuppList(prev => [...prev, newSuppInput.trim()]);
                      setNewSuppInput("");
                    }
                  }}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {suppList.map((s, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ color: "#fff", fontSize: 15 }}>· {s}</Text>
                    <TouchableOpacity onPress={() => setSuppList(prev => prev.filter((_, idx) => idx !== i))}>
                      <Text style={{ color: "#666", fontSize: 13 }}>remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveSupplements}>
                <Text style={styles.saveButtonText}>Save Supplements</Text>
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
  date: { color: "#888", fontSize: 16, marginBottom: 4 },
  session: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 24 },
  closedBanner: { backgroundColor: "#1a3a0a", borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 24 },
  closedBannerText: { color: "#4caf50", fontSize: 16, fontWeight: "700" },
  sectionHeader: { color: "#888", fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  checkbox: { fontSize: 24, marginRight: 12 },
  checkLabel: { color: "#fff", fontSize: 16 },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingRight: 4 },
  inputLabel: { color: "#666", fontSize: 14 },
  metricInput: { backgroundColor: "#1a1a1a", borderRadius: 8, padding: 8, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "#333", width: 100, textAlign: "right" },
  metricInputDisabled: { borderColor: "#222", color: "#555" },
  targets: { color: "#666", fontSize: 14, marginTop: 8, marginBottom: 32 },
  closeButton: { backgroundColor: "#555", borderRadius: 12, padding: 18, alignItems: "center" },
  closeButtonDone: { backgroundColor: "#2D5016" },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%" },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  modalSubtitle: { color: "#888", fontSize: 14, marginBottom: 24 },
  dayRow: { marginBottom: 16 },
  dayToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", borderRadius: 10, padding: 14 },
  dayName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  dayStatus: { color: "#666", fontSize: 14 },
  dayStatusActive: { color: "#4caf50", fontWeight: "600" },
  sessionInput: { backgroundColor: "#0a0a0a", borderRadius: 8, padding: 12, color: "#fff", marginTop: 8, borderWidth: 1, borderColor: "#333" },
  saveButton: { backgroundColor: "#2D5016", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" }
});