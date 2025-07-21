import TextInputField from "@/components/TextInputField";
import { loginUser } from "@/services/authService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const auth = use$(authState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const buttonScale = new Animated.Value(1);

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
        authState.user.set(user);
        authState.error.set("");
        // Navigate to main screen, e.g., router.push('/home')
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header Section */}
          <View className="items-center mb-12">
            <View className="w-20 h-20 bg-black rounded-full items-center justify-center mb-6">
              <Text className="text-white text-3xl font-bold">C</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </Text>
            <Text className="text-gray-600 text-center">
              Sign in to your Chaai Point account
            </Text>
          </View>

          {/* Form Section */}
          <View className="space-y-4">
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
              />
              {emailError ? (
                <Text className="text-red-500 text-sm mt-1 ml-1">
                  {emailError}
                </Text>
              ) : null}
            </View>

            <View>
              <TextInputField
                label="Password"
                value={password}
                secureTextEntry
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) validatePassword(text);
                }}
                onBlur={() => validatePassword(password)}
                autoComplete="password"
              />
              {passwordError ? (
                <Text className="text-red-500 text-sm mt-1 ml-1">
                  {passwordError}
                </Text>
              ) : null}
            </View>

            {/* TODO:Forgot Password Link */}
            {/* <TouchableOpacity className="self-end">
              <Text className="text-black font-medium">Forgot Password?</Text>
            </TouchableOpacity> */}
          </View>

          {/* Error Message */}
          {auth.error ? (
            <View className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
              <Text className="text-red-700 text-center">{auth.error}</Text>
            </View>
          ) : null}

          {/* Login Button */}
          <Animated.View
            style={{ transform: [{ scale: buttonScale }] }}
            className="mt-8"
          >
            <TouchableOpacity
              className={`py-4 rounded-full items-center justify-center ${
                auth.loading || !isFormValid ? "bg-gray-300" : "bg-black"
              }`}
              onPress={onLogin}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              disabled={auth.loading || !isFormValid}
              activeOpacity={0.8}
            >
              {auth.loading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white font-semibold ml-2">
                    Signing In...
                  </Text>
                </View>
              ) : (
                <Text
                  className={`font-semibold text-lg ${
                    auth.loading || !isFormValid
                      ? "text-gray-500"
                      : "text-white"
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
