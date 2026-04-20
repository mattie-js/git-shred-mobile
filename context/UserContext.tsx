import { createContext, useContext, useState } from "react";

type UserContextType = {
  userId: number | null;
  setUserId: (id: number) => void;
  checkinDay: number | null;
  setCheckinDay: (day: number) => void;
};

const UserContext = createContext<UserContextType>({
  userId: null,
  setUserId: () => {},
  checkinDay: null,
  setCheckinDay: () => {}
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [checkinDay, setCheckinDay] = useState<number | null>(null);

  return (
    <UserContext.Provider value={{ userId, setUserId, checkinDay, setCheckinDay }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
