import { supabase } from "./supabase/index";
import { formatPhoneE164 } from "./dedup-utils";

export interface CallValidationResult {
  allowed: boolean;
  warnings: string[];
  blockers: string[];
  metadata?: {
    isBusinessHours?: boolean;
    lastCallTime?: string;
    callCount24h?: number;
  };
}

export class CallValidationService {

  /**
   * Validates if a call should be allowed based on business rules
   */
  static async validateCall(
    phoneNumber: string, 
    buyerId?: string,
    userId?: string
  ): Promise<CallValidationResult> {
    const result: CallValidationResult = {
      allowed: true,
      warnings: [],
      blockers: [],
      metadata: {}
    };

    try {
      const formattedPhone = formatPhoneE164(phoneNumber) || phoneNumber;

      // Run all validations in parallel
      const [
        businessHoursCheck,
        dncCheck,
        buyerStatusCheck
      ] = await Promise.all([
        this.checkBusinessHours(),
        this.checkDoNotCall(formattedPhone),
        buyerId ? this.checkBuyerStatus(buyerId) : Promise.resolve({ allowed: true, message: "" })
      ]);

      // Collect results
      result.metadata.isBusinessHours = businessHoursCheck.isBusinessHours;

      // Check for blockers
      if (!businessHoursCheck.isBusinessHours && businessHoursCheck.enforceHours) {
        result.blockers.push("Outside business hours (9 AM - 6 PM EST)");
      }

      // Removed call frequency blocking - no rate limits

      if (!dncCheck.allowed) {
        result.blockers.push(dncCheck.message);
      }

      if (!buyerStatusCheck.allowed) {
        result.blockers.push(buyerStatusCheck.message);
      }

      // Check for warnings - removed rate limit warnings

      // Commented out business hours warning - users can call anytime
      // if (!businessHoursCheck.isBusinessHours && !businessHoursCheck.enforceHours) {
      //   result.warnings.push("Calling outside business hours");
      // }

      // Final determination
      result.allowed = result.blockers.length === 0;

      return result;

    } catch (error) {
      console.error("Call validation error:", error);
      return {
        allowed: false,
        warnings: [],
        blockers: ["Validation system error - please try again"]
      };
    }
  }

  /**
   * Check if current time is within business hours
   */
  private static checkBusinessHours(): { isBusinessHours: boolean; enforceHours: boolean } {
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = easternTime.getHours();
    const day = easternTime.getDay(); // 0 = Sunday, 6 = Saturday

    const isWeekday = day >= 1 && day <= 5; // Monday to Friday
    const isBusinessHour = hour >= 9 && hour < 18; // 9 AM to 6 PM

    return {
      isBusinessHours: isWeekday && isBusinessHour,
      enforceHours: false // Set to true to block calls outside business hours
    };
  }


  /**
   * Check Do Not Call list
   */
  private static async checkDoNotCall(phoneNumber: string): Promise<{ allowed: boolean; message: string }> {
    try {
      // Check if buyer has opted out of calls
      const { data: buyer } = await supabase
        .from("buyers")
        .select("can_receive_calls")
        .or(`phone.eq.${phoneNumber},phone2.eq.${phoneNumber},phone3.eq.${phoneNumber}`)
        .maybeSingle();

      if (buyer && buyer.can_receive_calls === false) {
        return {
          allowed: false,
          message: "Buyer has opted out of calls"
        };
      }

      // TODO: Add integration with national DNC registry if required
      
      return { allowed: true, message: "" };

    } catch (error) {
      console.error("Error checking DNC list:", error);
      return { allowed: true, message: "" };
    }
  }

  /**
   * Check buyer status
   */
  private static async checkBuyerStatus(buyerId: string): Promise<{ allowed: boolean; message: string }> {
    try {
      const { data: buyer } = await supabase
        .from("buyers")
        .select("status, can_receive_calls")
        .eq("id", buyerId)
        .maybeSingle();

      if (!buyer) {
        // If buyer not found, allow call (might be a direct phone number call)
        return { allowed: true, message: "" };
      }

      if (buyer.can_receive_calls === false) {
        return { allowed: false, message: "Buyer has disabled calls" };
      }

      // Check if buyer is in a status where calls don't make sense
      if (buyer.status === 'closed' || buyer.status === 'do_not_contact') {
        return { allowed: false, message: `Buyer status: ${buyer.status}` };
      }

      return { allowed: true, message: "" };

    } catch (error) {
      console.error("Error checking buyer status:", error);
      return { allowed: true, message: "" };
    }
  }
}

export { formatPhoneE164 } from "./dedup-utils";