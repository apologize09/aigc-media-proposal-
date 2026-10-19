export type HealthReport = {
  status: "ok";
};

export function createHealthReport(): HealthReport {
  return { status: "ok" };
}
