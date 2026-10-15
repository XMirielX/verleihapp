// Shared ordering and status symbols for event selectors.
function getEventStatusSortRank(event) {
  const statusOrder = { 20: 1, 10: 2, 90: 3, 95: 4 };
  return statusOrder[Number(event.stat)] ?? 99;
}

function sortEventsByStatus(events) {
  return events.sort((a, b) => {
    const order = getEventStatusSortRank(a) - getEventStatusSortRank(b);
    return order || new Date(a.start) - new Date(b.start);
  });
}

function getEventStatusSymbol(stat) {
  switch (Number(stat)) {
    case 20: return "🔵";
    case 10: return "🟢";
    case 90:
    case 95: return "⛔";
    default: return "⚪";
  }
}
