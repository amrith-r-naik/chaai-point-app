// app/(modals)/customer-form.tsx
import TextInputField from "@/components/TextInputField";
import { createCustomer, updateCustomer } from "@/services/customerService";
import { clearCustomerError, customerState } from "@/state/customerState";
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";

export default function CustomerFormScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [nameError, setNameError] = useState("");
  const [contactError, setContactError] = useState("");

  const customerStateData = use$(customerState);
  const customer = customerStateData.selectedCustomer;
  const isEditing = !!customer;

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setContact(customer.contact || "");
    } else {
      setName("");
      setContact("");
    }
    setNameError("");
    setContactError("");
    clearCustomerError();
  }, [customer]);

  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError("Customer name is required");
      return false;
    }
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      return false;
    }
    setNameError("");
    return true;
  };

  const validateContact = (contact: string) => {
    if (contact.trim() && contact.trim().length < 10) {
      setContactError("Contact must be at least 10 digits");
      return false;
    }
    setContactError("");
    return true;
  };

  const handleSubmit = async () => {
    const isNameValid = validateName(name);
    const isContactValid = validateContact(contact);

    if (!isNameValid || !isContactValid) {
      return;
    }

    customerState.loading.set(true);
    customerState.error.set("");

    try {
      if (isEditing && customer) {
        await updateCustomer(
          customer.id,
          name.trim(),
          contact.trim() || undefined
        );
      } else {
        await createCustomer(name.trim(), contact.trim() || undefined);
      }

      // Show success message
      Alert.alert(
        "Success",
        `Customer ${isEditing ? "updated" : "added"} successfully!`,
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      customerState.error.set(error.message || "Failed to save customer");
    } finally {
      customerState.loading.set(false);
    }
  };

  const handleClose = () => {
    if (customerStateData.loading) return;

    // Reset selection state
    customerState.selectedCustomer.set(null);

    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? "Edit Customer" : "Add Customer",
          headerTintColor: theme.colors.text,
          headerStyle: {
            backgroundColor: "white",
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
          },
        }}
      />
      <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            {/* Form Fields */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginBottom: 16,
                }}
              >
                Customer Information
              </Text>

              <View style={{ marginBottom: 20 }}>
                <TextInputField
                  label="Customer Name *"
                  value={name}
                  onChangeText={setName}
                  onBlur={() => validateName(name)}
                  editable={!customerStateData.loading}
                />
                {nameError ? (
                  <Text
                    style={{
                      color: theme.colors.error || "#ef4444",
                      fontSize: 14,
                    }}
                  >
                    {nameError}
                  </Text>
                ) : null}
              </View>

              <View>
                <TextInputField
                  label="Contact Number (Optional)"
                  value={contact}
                  onChangeText={setContact}
                  onBlur={() => validateContact(contact)}
                  keyboardType="phone-pad"
                  editable={!customerStateData.loading}
                />
                {contactError ? (
                  <Text
                    style={{
                      color: theme.colors.error || "#ef4444",
                      fontSize: 14,
                    }}
                  >
                    {contactError}
                  </Text>
                ) : null}
              </View>

              {/* Helper Text */}
              <View
                style={{
                  backgroundColor: "#f0f9ff",
                  padding: 12,
                  borderRadius: 12,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "#e0f2fe",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: "#0369a1",
                    lineHeight: 20,
                  }}
                >
                  💡 Add a contact number to easily identify and reach your
                  customers. This information helps with order management and
                  customer service.
                </Text>
              </View>
            </View>

            {/* Error Display */}
            {customerStateData.error ? (
              <View
                style={{
                  backgroundColor: "#fef2f2",
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: "#fecaca",
                }}
              >
                <Text
                  style={{
                    color: "#dc2626",
                    fontSize: 14,
                    fontWeight: "500",
                  }}
                >
                  {customerStateData.error}
                </Text>
              </View>
            ) : null}

            {/* Bottom Actions (Mobile Fallback) */}
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  flex: 1,
                  backgroundColor: "#f3f4f6",
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                }}
                disabled={customerStateData.loading}
              >
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                style={{
                  flex: 1,
                  backgroundColor: customerStateData.loading
                    ? theme.colors.borderLight
                    : theme.colors.primary,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: customerStateData.loading ? 0.6 : 1,
                }}
                disabled={customerStateData.loading}
              >
                <Text
                  style={{
                    color: "white",
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  {customerStateData.loading
                    ? "Saving..."
                    : isEditing
                      ? "Update Customer"
                      : "Add Customer"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
