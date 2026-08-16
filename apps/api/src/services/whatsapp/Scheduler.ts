// Scheduler is disabled for now. Provide a no-op implementation.
export class WhatsappScheduler {
  async start(_campaignId: number) {
    return;
  }
  async pause(_campaignId: number) {
    return;
  }
}
