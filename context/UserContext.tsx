import { createContext, useContext, useState } from "react";

type Plan = {
  plan_id: number;
  cal_rx: number;
  protein_rx: number;
  carb_rx: number;
  fat_rx: number;
  tdee: number;
  goal_weight: number;
  weeks_to_goal: number;
  rate_of_loss_pct: number;
  prescribed_steps: number | null;
};

type UserContextType = {
  userId: number | null;
  setUserId: (id: number) => void;
  checkinDay: number | null;
  setCheckinDay: (day: number) => void;
  plan: Plan | null;
  setPlan: (plan: Plan) => void;
};

const UserContext = createContext<UserContextType>({
  userId: null,
  setUserId: () => {},
  checkinDay: null,
  setCheckinDay: () => {},
  plan: null,
  setPlan: () => {}
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [checkinDay, setCheckinDay] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  return (
    <UserContext.Provider value={{ userId, setUserId, checkinDay, setCheckinDay, plan, setPlan }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}