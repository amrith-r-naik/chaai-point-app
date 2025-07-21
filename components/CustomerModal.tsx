import TextInputField from "@/components/TextInputField";
import {
  Customer,
  createCustomer,
  updateCustomer,
} from "@/services/customerService";
import { clearCustomerError, customerState } from "@/state/customerState";
import { use$ } from "@legendapp/state/react";
import React, { useEffect, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

interface CustomerModalProps {
  visible: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CustomerModal({
  visible,
  customer,
  onClose,
  onSuccess,
}: CustomerModalProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [nameError, setNameError] = useState("");
  const [contactError, setContactError] = useState("");

  const customerStateData = use$(customerState);
  const isEditing = !!customer;

  useEffect(() => {
    if (visible) {
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
    }
  }, [visible, customer]);

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

      onSuccess();
      onClose();
    } catch (error: any) {
      customerState.error.set(error.message || "Failed to save customer");
    } finally {
      customerState.loading.set(false);
    }
  };

  const handleClose = () => {
    if (customerStateData.loading) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white w-11/12 max-w-md rounded-xl p-6 shadow-xl">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-gray-800">
              {isEditing ? "Edit Customer" : "Add New Customer"}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              className="p-2"
              disabled={customerStateData.loading}
            >
              <Text className="text-gray-500 text-lg">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <TextInputField
                label="Customer Name *"
                value={name}
                onChangeText={setName}
                onBlur={() => validateName(name)}
              />
              {nameError && (
                <Text className="text-red-500 text-sm mt-1">{nameError}</Text>
              )}
            </View>

            <View>
              <TextInputField
                label="Contact Number (Optional)"
                value={contact}
                onChangeText={setContact}
                onBlur={() => validateContact(contact)}
                keyboardType="phone-pad"
              />
              {contactError && (
                <Text className="text-red-500 text-sm mt-1">
                  {contactError}
                </Text>
              )}
            </View>

            {/* Error Display */}
            {customerStateData.error && (
              <View className="bg-red-50 p-3 rounded-lg border border-red-200">
                <Text className="text-red-600 text-sm">
                  {customerStateData.error}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row space-x-3 mt-6">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 bg-gray-100 py-3 rounded-lg"
              disabled={customerStateData.loading}
            >
              <Text className="text-gray-700 font-medium text-center">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              className={`flex-1 py-3 rounded-lg ${
                customerStateData.loading ? "bg-blue-300" : "bg-blue-600"
              }`}
              disabled={customerStateData.loading}
            >
              <Text className="text-white font-medium text-center">
                {customerStateData.loading
                  ? "Saving..."
                  : isEditing
                    ? "Update"
                    : "Add Customer"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
