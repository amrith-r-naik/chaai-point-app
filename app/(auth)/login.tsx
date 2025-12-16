import TextInputField from "@/components/TextInputField";
import { loginUser } from "@/services/authService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  // Granular state subscriptions for optimized re-renders
  const authLoading = use$(authState.loading);
  const authError = use$(authState.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const buttonScale = new Animated.Value(1);
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardOffset(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const onLogin = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    authState.loading.set(true);
    authState.error.set("");

    try {
      const user = await loginUser(email, password);
      if (user) {
        authState.error.set("");
        // Router will automatically redirect via _layout.tsx
        router.replace("/" as any);
      } else {
        authState.error.set("Invalid email or password. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      authState.error.set("Something went wrong. Please try again.");
    } finally {
      authState.loading.set(false);
    }
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const isFormValid = email && password && !emailError && !passwordError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 20}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 0 + keyboardOffset,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header Section */}
          <View className="items-center mb-12">
            <Image
              source={require("@/assets/images/icon.png")}
              style={{
                width: 96,
                height: 96,
                marginBottom: 24,
                borderRadius: 80,
              }}
              resizeMode="contain"
            />
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </Text>
            <Text className="text-gray-600 text-center">
              Sign in to your Chaai Point account
            </Text>
          </View>
          {/* Form Card */}
          <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {/* Form Section */}
            <View className="flex gap-3">
              <View>
                <TextInputField
                  label="Email Address"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) validateEmail(text);
                  }}
                  onBlur={() => validateEmail(email)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="you@shop.com"
                  leftIcon={<Mail size={18} color="#6b7280" />}
                />
                {emailError ? (
                  <Text className="-mt-3 text-red-500 text-sm ml-1">
                    {emailError}
                  </Text>
                ) : null}
              </View>

              <View>
                <TextInputField
                  label="Password"
                  value={password}
                  secureTextEntry={!showPassword}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) validatePassword(text);
                  }}
                  onBlur={() => validatePassword(password)}
                  autoComplete="password"
                  autoCapitalize="none"
                  placeholder="••••••••"
                  leftIcon={<Lock size={18} color="#6b7280" />}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword((s) => !s)}
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color="#6b7280" />
                      ) : (
                        <Eye size={18} color="#6b7280" />
                      )}
                    </TouchableOpacity>
                  }
                  returnKeyType="done"
                  onSubmitEditing={onLogin}
                />
                {passwordError ? (
                  <Text className="text-red-500 text-sm -mt-3 ml-1">
                    {passwordError}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Error Message */}
          {authError ? (
            <View className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
              <Text className="text-red-700 text-center">{authError}</Text>
            </View>
          ) : null}

          {/* Login Button */}
          <Animated.View
            style={{ transform: [{ scale: buttonScale }] }}
            className="mt-8"
          >
            <TouchableOpacity
              className={`py-4 rounded-full items-center justify-center ${
                authLoading || !isFormValid ? "bg-gray-300" : "bg-black"
              }`}
              onPress={onLogin}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              disabled={authLoading || !isFormValid}
              activeOpacity={0.8}
            >
              {authLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white font-semibold ml-2">
                    Signing In...
                  </Text>
                </View>
              ) : (
                <Text
                  className={`font-semibold text-lg ${
                    authLoading || !isFormValid ? "text-gray-500" : "text-white"
                  }`}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
