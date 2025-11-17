export interface TransferState {
  isTransferring: boolean;
  transferType: 'blind' | 'attended' | null;
  transferDestination?: string;
  consultLegId?: string;
  customerLegId: string;
  agentLegId: string;
  step: 'idle' | 'consult-dialing' | 'consult-active' | 'completing' | 'cancelling' | 'done' | 'error';
  error?: string;
}

export class TransferService {
  static async blindTransfer(sessionId: string, destination: string) {
    const response = await fetch('/api/calls/transfer/blind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, destination })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Transfer failed');
    }
    
    return response.json();
  }
  
  static async startAttendedTransfer(
    customerLegId: string, 
    agentLegId: string, 
    destination: string
  ) {
    const response = await fetch('/api/calls/transfer/attended/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerLegId, agentLegId, destination })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start attended transfer');
    }
    
    return response.json();
  }
  
  static async bridgeAgentToConsult(customerLegId: string, agentLegId: string, consultLegId: string) {
    const response = await fetch('/api/calls/transfer/attended/bridge-consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerLegId, consultLegId, agentLegId})
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bridge to consult');
    }
    
    return response.json();
  }
  
  static async completeAttendedTransfer(
    customerLegId: string,
    consultLegId: string,
    agentLegId: string
  ) {
    const response = await fetch('/api/calls/transfer/attended/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerLegId, consultLegId, agentLegId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to complete transfer');
    }
    
    return response.json();
  }
  
  static async cancelAttendedTransfer(
    customerLegId: string,
    agentLegId: string,
    consultLegId: string
  ) {
    const response = await fetch('/api/calls/transfer/attended/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerLegId, agentLegId, consultLegId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel transfer');
    }
    
    return response.json();
  }
  
  static validateDestination(destination: string): boolean {
    // E.164 format
    if (/^\+\d{10,15}$/.test(destination)) return true;
    
    // SIP URI format
    if (/^sip:[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(destination)) return true;
    
    // Extension format (3-5 digits)
    if (/^\d{3,5}$/.test(destination)) return true;
    
    return false;
  }
  
  static formatDestination(destination: string): string {
    // If it's an extension, convert to SIP URI
    if (/^\d{3,5}$/.test(destination)) {
      return `sip:ext${destination}@sip.telnyx.com`;
    }
    
    // If it's a phone number without +, add it
    if (/^\d{10,15}$/.test(destination)) {
      return `+${destination}`;
    }
    
    return destination;
  }
}
