import { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine, VictoryScatter } from "victory-native";
import { useUser } from "../../context/UserContext";
import { getDailyLogHistory } from "../../services/api";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

// ── helpers ────────────────────────────────────────────────────

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const formatWeekLabel = (weekStart: Date): string => {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};

const formatMonthLabel = (year: number, month: number): string => {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const shortDate = (dateStr: string): string => {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const getBWDomain = (points: { y: number }[], padding: number = 1.5): [number, number] => {
  if (!points.length) return [160, 200];
  const vals = points.map(p => p.y);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = Math.max(padding, (max - min) * 0.5);
  return [parseFloat((min - pad).toFixed(1)), parseFloat((max + pad).toFixed(1))];
};

const getStepsDomain = (points: { y: number }[]): [number, number] => {
  if (!points.length) return [0, 12000];
  const vals = points.map(p => p.y);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = Math.max(2000, (max - min) * 0.5);
  return [Math.max(0, Math.round(min - pad)), Math.round(max + pad)];
};

const getCardioDomain = (points: { y: number }[]): [number, number] => {
  if (!points.length) return [0, 60];
  const vals = points.map(p => p.y);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = Math.max(15, (max - min) * 0.5);
  return [Math.max(0, Math.round(min - pad)), Math.round(max + pad)];
};



// ── component ──────────────────────────────────────────────────

export default function ProgressScreen() {
  const { userId, plan, startingWeight } = useUser();
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]); // raw logs for heatmap (includes is_adherent)
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"W" | "M">("W");
  const [stepsMetric, setStepsMetric] = useState<"steps" | "cardio">("steps");

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekSelected, setWeekSelected] = useState<{ date: string; weight: number } | null>(null);
  const [weekStepSelected, setWeekStepSelected] = useState<{ date: string; value: number } | null>(null);

  const [monthOffset, setMonthOffset] = useState(0);
  const [monthSelected, setMonthSelected] = useState<{ date: string; weight: number } | null>(null);
  const [monthStepSelected, setMonthStepSelected] = useState<{ date: string; value: number } | null>(null);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    const logs = await getDailyLogHistory(userId);
    const raw = logs.history || [];

    // store raw for heatmap (keyed by date, keeping is_adherent and status)
    const adherenceMap: Record<string, { is_adherent: boolean; status: string }> = {};
    raw.forEach((l: any) => {
      if (!adherenceMap[l.date] || l.status === "completed") {
        adherenceMap[l.date] = { is_adherent: l.is_adherent, status: l.status };
      }
    });
    setAllLogs(Object.entries(adherenceMap).map(([date, v]) => ({ date, ...v })));

    const bwMap: Record<string, number[]> = {};
    const stepMap: Record<string, number[]> = {};
    const cardioMap: Record<string, number[]> = {};

    raw.forEach((l: any) => {
      if (l.bodyweight_lbs != null) {
        if (!bwMap[l.date]) bwMap[l.date] = [];
        bwMap[l.date].push(l.bodyweight_lbs);
      }
      if (l.step_count != null) {
        if (!stepMap[l.date]) stepMap[l.date] = [];
        stepMap[l.date].push(l.step_count);
      }
      if (l.cardio_minutes != null) {
        if (!cardioMap[l.date]) cardioMap[l.date] = [];
        cardioMap[l.date].push(l.cardio_minutes);
      }
    });

    const allDates = new Set([...Object.keys(bwMap), ...Object.keys(stepMap), ...Object.keys(cardioMap)]);
    const deduped = Array.from(allDates).map(date => ({
      date,
      bodyweight_lbs: bwMap[date] ? parseFloat((bwMap[date].reduce((a, b) => a + b, 0) / bwMap[date].length).toFixed(1)) : null,
      step_count: stepMap[date] ? Math.round(stepMap[date].reduce((a, b) => a + b, 0) / stepMap[date].length) : null,
      cardio_minutes: cardioMap[date] ? Math.round(cardioMap[date].reduce((a, b) => a + b, 0) / cardioMap[date].length) : null,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setDailyLogs(deduped);
    setLoading(false);
  };

  // ── week windowing ─────────────────────────────────────────────

  const planStart = plan?.created_at ? getWeekStart(new Date(plan.created_at)) : getWeekStart(new Date());
  const todayWeekStart = getWeekStart(new Date());
  const totalWeeks = Math.round((todayWeekStart.getTime() - planStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const clampedWeekOffset = Math.min(0, Math.max(-totalWeeks, weekOffset));
  const weekWindowStart = addDays(todayWeekStart, clampedWeekOffset * 7);
  const weekWindowEnd = addDays(weekWindowStart, 6);

  const weekLogs = dailyLogs.filter(l => {
    const d = new Date(l.date + "T12:00:00");
    return d >= weekWindowStart && d <= weekWindowEnd;
  });

  const weekBWPoints = weekLogs.filter(l => l.bodyweight_lbs != null).map((l, i) => ({ x: i + 1, y: l.bodyweight_lbs, date: l.date }));
  const weekStepsPoints = weekLogs.filter(l => l.step_count != null).map((l, i) => ({ x: i + 1, y: l.step_count, date: l.date }));
  const weekCardioPoints = weekLogs.filter(l => l.cardio_minutes != null).map((l, i) => ({ x: i + 1, y: l.cardio_minutes, date: l.date }));
  const weekBWDomain = getBWDomain(weekBWPoints, 1.5);
  const weekActiveBarPoints = stepsMetric === "steps" ? weekStepsPoints : weekCardioPoints;
  const weekActiveBarDomain = stepsMetric === "steps" ? getStepsDomain(weekActiveBarPoints) : getCardioDomain(weekActiveBarPoints);

  // ── month windowing ────────────────────────────────────────────

  const today = new Date();
  const planStartDate = plan?.created_at ? new Date(plan.created_at) : new Date();
  const totalMonths = (today.getFullYear() - planStartDate.getFullYear()) * 12 + (today.getMonth() - planStartDate.getMonth());
  const clampedMonthOffset = Math.min(0, Math.max(-totalMonths, monthOffset));
  const monthYear = today.getFullYear() + Math.floor((today.getMonth() + clampedMonthOffset) / 12);
  const monthMonth = ((today.getMonth() + clampedMonthOffset) % 12 + 12) % 12;

  const monthLogs = dailyLogs.filter(l => {
    const d = new Date(l.date + "T12:00:00");
    return d.getFullYear() === monthYear && d.getMonth() === monthMonth;
  });

  const monthBWPoints = monthLogs.filter(l => l.bodyweight_lbs != null).map((l, i) => ({ x: i + 1, y: l.bodyweight_lbs, date: l.date }));
  const monthStepsPoints = monthLogs.filter(l => l.step_count != null).map((l, i) => ({ x: i + 1, y: l.step_count, date: l.date }));
  const monthCardioPoints = monthLogs.filter(l => l.cardio_minutes != null).map((l, i) => ({ x: i + 1, y: l.cardio_minutes, date: l.date }));
  const monthBWDomain = getBWDomain(monthBWPoints, 2);
  const monthScatterPoints = monthBWPoints.filter((_, i) => i % 2 === 0);
  const monthActiveBarPoints = stepsMetric === "steps" ? monthStepsPoints : monthCardioPoints;
  const monthActiveBarDomain = stepsMetric === "steps" ? getStepsDomain(monthActiveBarPoints) : getCardioDomain(monthActiveBarPoints);

  // ── heatmap ────────────────────────────────────────────────────

  const buildHeatmap = () => {
    const adherenceMap: Record<string, { is_adherent: boolean; status: string }> = {};
    allLogs.forEach(l => { adherenceMap[l.date] = l; });

    const planStartISO = plan?.created_at ? plan.created_at.slice(0, 10) : null;
    const todayISO = today.toISOString().slice(0, 10);

    // first day of the displayed month
    const firstDay = new Date(monthYear, monthMonth, 1);
    // last day of displayed month
    const lastDay = new Date(monthYear, monthMonth + 1, 0);
    // day of week of the first day (0=Sun)

    const cells: { day: number | null; state: "empty" | "adherent" | "tracked" | "missed" | "future" | "pre-plan" }[] = [];

    const startDow = firstDay.getDay();
    for (let i = 0; i < startDow; i++) {
      cells.push({ day: null, state: "empty" });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateISO = `${monthYear}-${String(monthMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      let state: typeof cells[0]["state"];

      if (dateISO > todayISO) {
        state = "future";
      } else if (planStartISO && dateISO < planStartISO) {
        state = "pre-plan";
      } else {
        const log = adherenceMap[dateISO];
        if (!log || log.status !== "completed") {
          state = "missed";
        } else if (log.is_adherent) {
          state = "adherent";
        } else {
          state = "tracked";
        }
      }
      cells.push({ day: d, state });
    }

    return cells;
  };

  const heatmapCells = buildHeatmap();

  const cellColor = (state: string) => {
    if (state === "adherent") return "#2D5016";
    if (state === "tracked") return "#8a6800";
    if (state === "missed") return "#5a1a1a";
    return "#1a1a1a"; // future or pre-plan or empty
  };

  const cellTextColor = (state: string) => {
    if (state === "adherent") return "#7cba3e";
    if (state === "tracked") return "#f0b429";
    if (state === "missed") return "#c0392b";
    return "#333";
  };

  // ── goal progress ──────────────────────────────────────────────

  const goalWeight = plan?.goal_weight ?? null;
  const latestBW = dailyLogs.filter(l => l.bodyweight_lbs != null).slice(-1)[0]?.bodyweight_lbs ?? null;

  const goalPct = (() => {
    if (!startingWeight || !goalWeight || !latestBW) return null;
    const pct = ((startingWeight - latestBW) / (startingWeight - goalWeight)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  })();

  // ── x axis tick formatters ─────────────────────────────────────

  const weekXTicks = weekBWPoints.map(p => p.x);
  const weekXFormat = (x: number) => { const p = weekBWPoints.find(p => p.x === x); return p ? shortDate(p.date) : ""; };
  const weekBarXTicks = weekActiveBarPoints.map(p => p.x);
  const weekBarXFormat = (x: number) => { const p = weekActiveBarPoints.find(p => p.x === x); return p ? shortDate(p.date) : ""; };
  const monthXTicks = monthBWPoints.filter((_, i) => i % 7 === 0).map(p => p.x);
  const monthXFormat = (x: number) => { const p = monthBWPoints.find(p => p.x === x); return p ? shortDate(p.date) : ""; };
  const monthBarXTicks = monthActiveBarPoints.filter((_, i) => i % 7 === 0).map(p => p.x);
  const monthBarXFormat = (x: number) => { const p = monthActiveBarPoints.find(p => p.x === x); return p ? shortDate(p.date) : ""; };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

  const isWeek = view === "W";
  const navLabel = isWeek ? formatWeekLabel(weekWindowStart) : formatMonthLabel(monthYear, monthMonth);
  const canGoForward = isWeek ? clampedWeekOffset < 0 : clampedMonthOffset < 0;

  const goBack = () => {
    if (isWeek) { setWeekOffset(clampedWeekOffset - 1); setWeekSelected(null); setWeekStepSelected(null); }
    else { setMonthOffset(clampedMonthOffset - 1); setMonthSelected(null); setMonthStepSelected(null); }
  };
  const goForward = () => {
    if (isWeek && canGoForward) { setWeekOffset(clampedWeekOffset + 1); setWeekSelected(null); setWeekStepSelected(null); }
    else if (!isWeek && canGoForward) { setMonthOffset(clampedMonthOffset + 1); setMonthSelected(null); setMonthStepSelected(null); }
  };

  const bwPoints = isWeek ? weekBWPoints : monthBWPoints;
  const bwDomain = isWeek ? weekBWDomain : monthBWDomain;
  const hasBW = bwPoints.length >= 3;
  const scatterPoints = isWeek ? weekBWPoints : monthScatterPoints;
  const activeBarPoints = isWeek ? weekActiveBarPoints : monthActiveBarPoints;
  const activeBarDomain = isWeek ? weekActiveBarDomain : monthActiveBarDomain;
  const hasBars = activeBarPoints.length > 0;
  const selectedBW = isWeek ? weekSelected : monthSelected;
  const selectedStep = isWeek ? weekStepSelected : monthStepSelected;
  const xTicks = isWeek ? weekXTicks : monthXTicks;
  const xFormat = isWeek ? weekXFormat : monthXFormat;
  const barXTicks = isWeek ? weekBarXTicks : monthBarXTicks;
  const barXFormat = isWeek ? weekBarXFormat : monthBarXFormat;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress</Text>

      {/* view toggle */}
      <View style={styles.pillRow}>
        {(["W", "M"] as const).map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.pill, view === v && styles.pillActive]}
            onPress={() => { setView(v); setWeekSelected(null); setMonthSelected(null); setWeekStepSelected(null); setMonthStepSelected(null); }}
          >
            <Text style={[styles.pillText, view === v && styles.pillTextActive]}>
              {v === "W" ? "Week" : "Month"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* nav */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={goBack}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.windowLabel}>{navLabel}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={goForward}>
          <Text style={[styles.navArrow, !canGoForward && styles.navArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── BW chart ── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Bodyweight</Text>
        {hasBW ? (
          <View style={styles.chartContainer}>
            <VictoryChart width={CHART_WIDTH} height={200} padding={{ top: 16, bottom: 36, left: 58, right: 16 }} domain={{ y: bwDomain }}>
              <VictoryAxis tickValues={xTicks} tickFormat={xFormat} style={{ axis: { stroke: "#333" }, tickLabels: { fill: "#555", fontSize: 9 }, grid: { stroke: "#1a1a1a" } }} />
              <VictoryAxis dependentAxis domain={{ y: bwDomain }} style={{ axis: { stroke: "transparent" }, tickLabels: { fill: "#7cba3e", fontSize: 10 }, grid: { stroke: "#1e1e1e" } }} tickFormat={(v) => `${v}lb`} tickCount={5} />
              <VictoryLine data={bwPoints} style={{ data: { stroke: "#7cba3e", strokeWidth: 2 } }} interpolation="monotoneX" />
              <VictoryScatter data={scatterPoints} size={12} style={{ data: { fill: "transparent" } }}
                events={[{ target: "data", eventHandlers: { onPress: (_: any, { datum }: any) => {
                  if (isWeek) setWeekSelected({ date: datum.date, weight: datum.y });
                  else setMonthSelected({ date: datum.date, weight: datum.y });
                  return [];
                } } }]}
              />
              <VictoryScatter data={scatterPoints} size={6} style={{ data: { fill: "#7cba3e" } }} />
            </VictoryChart>
          </View>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>{bwPoints.length === 0 ? "No weight logged yet." : `${bwPoints.length} of 3 weigh-ins logged — keep going!`}</Text>
          </View>
        )}
        <View style={styles.detailCard}>
          {selectedBW ? (
            <>
              <Text style={styles.detailDate}>{new Date(selectedBW.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</Text>
              <Text style={styles.detailVal}>{selectedBW.weight.toFixed(1)} lb</Text>
            </>
          ) : (
            <Text style={styles.detailPlaceholder}>Tap a point to inspect</Text>
          )}
        </View>
      </View>

      {/* ── steps / cardio bar chart ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{stepsMetric === "steps" ? "Daily Steps" : "Cardio Minutes"}</Text>
          <View style={styles.metricToggleRow}>
            <TouchableOpacity style={[styles.metricToggle, stepsMetric === "steps" && styles.metricToggleActive]} onPress={() => setStepsMetric("steps")}>
              <Text style={[styles.metricToggleText, stepsMetric === "steps" && styles.metricToggleTextActive]}>Steps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.metricToggle, stepsMetric === "cardio" && styles.metricToggleActive]} onPress={() => setStepsMetric("cardio")}>
              <Text style={[styles.metricToggleText, stepsMetric === "cardio" && styles.metricToggleTextActive]}>Cardio</Text>
            </TouchableOpacity>
          </View>
        </View>
        {hasBars ? (
          <View style={styles.chartContainer}>
            <VictoryChart width={CHART_WIDTH} height={180} padding={{ top: 16, bottom: 36, left: 58, right: 16 }} domain={{ y: activeBarDomain }} domainPadding={{ x: isWeek ? 20 : 5 }}>
              <VictoryAxis tickValues={barXTicks} tickFormat={barXFormat} style={{ axis: { stroke: "#333" }, tickLabels: { fill: "#555", fontSize: 9 }, grid: { stroke: "#1a1a1a" } }} />
              <VictoryAxis dependentAxis domain={{ y: activeBarDomain }} style={{ axis: { stroke: "transparent" }, tickLabels: { fill: "#4a9eed", fontSize: 10 }, grid: { stroke: "#1e1e1e" } }}
                tickFormat={(v) => stepsMetric === "steps" ? `${(v / 1000).toFixed(0)}k` : `${v}m`} tickCount={5}
              />
              <VictoryBar data={activeBarPoints} style={{ data: { fill: "#4a9eed", opacity: 0.85 } }} barWidth={isWeek ? 24 : 6}
                events={[{ target: "data", eventHandlers: { onPress: (_: any, { datum }: any) => {
                  if (isWeek) setWeekStepSelected({ date: datum.date, value: datum.y });
                  else setMonthStepSelected({ date: datum.date, value: datum.y });
                  return [];
                } } }]}
              />
            </VictoryChart>
          </View>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>{stepsMetric === "steps" ? "No step data logged yet." : "No cardio data logged yet."}</Text>
          </View>
        )}
        <View style={styles.detailCard}>
          {selectedStep ? (
            <>
              <Text style={styles.detailDate}>{new Date(selectedStep.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</Text>
              <Text style={[styles.detailVal, { color: "#4a9eed" }]}>{stepsMetric === "steps" ? selectedStep.value.toLocaleString() + " steps" : selectedStep.value + " min"}</Text>
            </>
          ) : (
            <Text style={styles.detailPlaceholder}>Tap a bar to inspect</Text>
          )}
        </View>
      </View>

      {/* ── goal progress bar ── */}
      {goalPct !== null && startingWeight && goalWeight && latestBW && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Goal Progress</Text>
          <View style={styles.goalLabelRow}>
            <Text style={styles.goalLabel}>{startingWeight} lb</Text>
            <Text style={styles.goalPct}>{goalPct}%</Text>
            <Text style={styles.goalLabel}>{goalWeight} lb</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goalPct}%` }]} />
          </View>
          <Text style={styles.currentWeight}>Current: {latestBW.toFixed(1)} lb</Text>
        </View>
      )}

      {/* ── adherence heatmap (month view only) ── */}
      {!isWeek && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Adherence</Text>

          {/* legend */}
          <View style={styles.legendRow}>
            {[
              { color: "#2D5016", textColor: "#7cba3e", label: "Fully adherant" },
              { color: "#8a6800", textColor: "#f0b429", label: "Partially Adherant" },
              { color: "#5a1a1a", textColor: "#c0392b", label: "Didn't log" },
            ].map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendLabel, { color: item.textColor }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.calendarGrid}>


            {/* calendar cells */}
            {heatmapCells.map((cell, i) => (
              <View
                key={i}
                style={[
                  styles.calendarCell,
                  styles.calendarDayCell,
                  { backgroundColor: cell.day ? cellColor(cell.state) : "transparent" }
                ]}
              >
                {cell.day && (
                  <Text style={[styles.calendarDayNum, { color: cellTextColor(cell.state) }]}>
                    {cell.day}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#000" },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#fff" },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 20 },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pill: { paddingVertical: 6, paddingHorizontal: 20, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333" },
  pillActive: { backgroundColor: "#2D5016", borderColor: "#2D5016" },
  pillText: { color: "#666", fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  navBtn: { padding: 8 },
  navArrow: { color: "#666", fontSize: 28 },
  navArrowDisabled: { color: "#2a2a2a" },
  windowLabel: { color: "#aaa", fontSize: 14, fontWeight: "500" },
  section: { marginBottom: 32 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionHeader: { color: "#888", fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  metricToggleRow: { flexDirection: "row", gap: 4 },
  metricToggle: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#1a1a1a" },
  metricToggleActive: { backgroundColor: "rgba(74,158,237,0.2)" },
  metricToggleText: { color: "#555", fontSize: 11, fontWeight: "600" },
  metricToggleTextActive: { color: "#4a9eed" },
  chartContainer: { marginLeft: -16 },
  emptyChart: { height: 120, justifyContent: "center", alignItems: "center", backgroundColor: "#111", borderRadius: 12 },
  emptyText: { color: "#555", fontSize: 13, textAlign: "center", paddingHorizontal: 24, lineHeight: 20 },
  detailCard: { backgroundColor: "#111", borderRadius: 12, padding: 14, marginTop: 8, minHeight: 52, justifyContent: "center" },
  detailDate: { color: "#888", fontSize: 12, marginBottom: 4 },
  detailVal: { color: "#7cba3e", fontSize: 22, fontWeight: "700" },
  detailPlaceholder: { color: "#444", fontSize: 13, textAlign: "center" },
  goalLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  goalLabel: { color: "#666", fontSize: 12 },
  goalPct: { color: "#7cba3e", fontSize: 16, fontWeight: "700" },
  progressTrack: { height: 10, backgroundColor: "#1a1a1a", borderRadius: 5, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", backgroundColor: "#2D5016", borderRadius: 5 },
  currentWeight: { color: "#666", fontSize: 12 },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { fontSize: 11 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", width: SCREEN_WIDTH - 32, gap: 4 },
  calendarCell: { width: (SCREEN_WIDTH - 32 - 24) / 7, alignItems: "center", justifyContent: "center" },
  calendarDayCell: { width: (SCREEN_WIDTH - 32) / 7 - 6, height: (SCREEN_WIDTH - 32) / 7 - 6, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  calendarDayNum: { fontSize: 11, fontWeight: "600" },
});