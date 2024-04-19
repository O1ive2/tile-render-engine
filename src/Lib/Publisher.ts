export default class Publisher {
  private subscribers: ((data: any) => void)[] = [];

  subscribe(callback: (data: any) => void) {
    this.subscribers.push(callback);
  }

  unsubscribe(callback: (data: any) => void) {
    this.subscribers = this.subscribers.filter((sub) => sub !== callback);
  }

  publish(data: any) {
    this.subscribers.forEach((subscriber) => {
      subscriber(data);
    });
  }
}
