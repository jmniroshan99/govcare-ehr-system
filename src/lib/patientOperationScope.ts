/** Cancel operations on a patient switch and suppress late responses, even if an API ignores abort. */
export class PatientOperationScope {
  private live = true;
  private requests = new Set<AbortController>();
  begin() {
    const controller = new AbortController();
    if (this.live) this.requests.add(controller);
    else controller.abort();
    return controller;
  }
  accepts(controller: AbortController) { return this.live && this.requests.has(controller) && !controller.signal.aborted; }
  isLive() { return this.live; }
  finish(controller: AbortController) { this.requests.delete(controller); }
  dispose() {
    this.live = false;
    this.requests.forEach(controller => controller.abort());
    this.requests.clear();
  }
}
