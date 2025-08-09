// services/serviceRegistry.ts
import { billingService } from './billingService';
import { eodService } from './eodService';
import { kotService } from './kotService';
import { paymentService } from './paymentService';
import { statsService } from './statsService';

export const services = { billingService, paymentService, statsService, kotService, eodService };
export type ServiceRegistry = typeof services;
export function getServices() { return services; }
