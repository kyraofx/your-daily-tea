function pacificSixAm(dateString) {
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", timeZoneName: "longOffset",
  }).formatToParts(new Date(`${dateString}T12:00:00Z`)).find((part) => part.type === "timeZoneName")?.value;
  const match = zone?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error("Could not resolve Pacific time.");
  const offset = (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6) - offset * 60_000);
}

export function coverageWindow(editionDate) {
  const boundary = pacificSixAm(editionDate);
  const prior = new Date(`${editionDate}T12:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  return {
    coverageStartsAt: pacificSixAm(prior.toISOString().slice(0, 10)).toISOString(),
    coverageEndsAt: new Date(boundary.getTime() - 1).toISOString(),
  };
}
