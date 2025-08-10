import { Alert } from "react-native";

/**
 * Centralized toast utility for payment flow notifications
 * In a production app, this would integrate with a proper toast library
 */

interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
}

class ToastUtil {
  /**
   * Show a toast message
   * Currently using Alert.alert as a simple implementation
   * In production, replace with a proper toast library like react-native-toast-message
   */
  static show(message: string, options: ToastOptions = {}) {
    const { type = 'info' } = options;
    
    // For now, use Alert.alert with different titles based on type
    const titles = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info'
    };

    Alert.alert(titles[type], message);
  }

  static success(message: string, options: Omit<ToastOptions, 'type'> = {}) {
    this.show(message, { ...options, type: 'success' });
  }

  static error(message: string, options: Omit<ToastOptions, 'type'> = {}) {
    this.show(message, { ...options, type: 'error' });
  }

  static warning(message: string, options: Omit<ToastOptions, 'type'> = {}) {
    this.show(message, { ...options, type: 'warning' });
  }

  static info(message: string, options: Omit<ToastOptions, 'type'> = {}) {
    this.show(message, { ...options, type: 'info' });
  }

  /**
   * Show payment success toast
   */
  static paymentSuccess(message: string) {
    this.success(message);
  }

  /**
   * Show credit-related toast
   */
  static creditUpdate(message: string) {
    this.warning(message);
  }

  /**
   * Show payment error toast
   */
  static paymentError(message: string) {
    this.error(message);
  }
}

export default ToastUtil;
