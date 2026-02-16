import RentHistoryChart from "@/components/RentHistoryChart";

export default function TestRentChart() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Test RentHistoryChart</h1>

      {/* Wichtig: Block-Container mit echter Breite */}
      <div style={{ width: "100%", maxWidth: 1000 }}>
        {/* Wichtig: minWidth:0 hilft bei Flex/Overflow-Kontexten */}
        <div style={{ width: "100%", minWidth: 0 }}>
          <RentHistoryChart scopeType="user" />
        </div>
      </div>
    </div>
  );
}
