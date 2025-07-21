import { observable } from "@legendapp/state";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  id: string;
  email: string;
  role: string;
}

export const authState = observable({
  user: null as User | null,
  loading: false,
  error: "" as string,
  isInitialized: false,
  isDbReady: false,
});

// Session persistence functions
export const saveUserSession = async (user: User) => {
  try {
    await AsyncStorage.setItem("userSession", JSON.stringify(user));
  } catch (error) {
    console.error("Error saving user session:", error);
  }
};

export const loadUserSession = async () => {
  try {
    const userSession = await AsyncStorage.getItem("userSession");
    if (userSession) {
      const user = JSON.parse(userSession);
      authState.user.set(user);
      return user;
    }
  } catch (error) {
    console.error("Error loading user session:", error);
  }
  return null;
};

export const clearUserSession = async () => {
  try {
    await AsyncStorage.removeItem("userSession");
    authState.user.set(null);
  } catch (error) {
    console.error("Error clearing user session:", error);
  }
};
