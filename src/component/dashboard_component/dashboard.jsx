import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";

import { database } from "../../dtb/firebase";
import {
  ref,
  onValue,
  set,
} from "firebase/database";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const formatLight = (value) => {
  const v =
    typeof value === "string"
      ? parseInt(value, 10)
      : typeof value === "boolean"
      ? value ? 1 : 0
      : value;

  if (v === 1) return "Sáng";
  if (v === 0) return "Tối";
  return "--";
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);

  const [lightOn, setLightOn] = useState(false);
  const [pumpOn, setPumpOn] = useState(false);
  const [lightAuto, setLightAuto] = useState(true);
  const [expandedChart, setExpandedChart] = useState(null);

  const [fingerHistory, setFingerHistory] = useState([]);
  const [now, setNow] = useState(new Date());

  // Cập nhật đồng hồ trên UI
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Lắng nghe sensorHistory
  useEffect(() => {
    const historyRef = ref(database, "sensorHistory");

    const unsubscribe = onValue(historyRef, (snapshot) => {
      const obj = snapshot.val();
      if (!obj) {
        setHistory([]);
        setLatest(null);
        return;
      }

      const arr = Object.entries(obj).map(([id, row]) => ({
        id,
        ...row,
      }));

      // sắp xếp theo id tăng dần
      arr.sort((a, b) => {
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return Number(a.id) - Number(b.id);
      });

      // lưu toàn bộ (cho chart), nhưng giới hạn 50 mẫu là đủ
      const all = arr.slice(-50);
      setHistory(all);

      // mẫu mới nhất
      setLatest(all[all.length - 1]);
    });

    return () => unsubscribe();
  }, []);

  // Lắng nghe trạng thái điều khiển
  useEffect(() => {
    const controlRef = ref(database, "control");
    const unsubscribe = onValue(controlRef, (snapshot) => {
      const val = snapshot.val() || {};
      setLightOn(!!val.light);
      setPumpOn(!!val.pump);
      setLightAuto(
        val.lightAuto !== undefined ? !!val.lightAuto : true // default AUTO
      );
    });
    return () => unsubscribe();
  }, []);

  // Lắng nghe lịch sử vân tay
  useEffect(() => {
    const fingerRef = ref(database, "fingerHistory");
    const unsubscribe = onValue(fingerRef, (snapshot) => {
      const obj = snapshot.val();
      if (!obj) {
        setFingerHistory([]);
        return;
      }
      const arr = Object.entries(obj).map(([id, row]) => ({
        id,
        ...row,
      }));

      // sort theo thời gian thêm (Firebase push key ~ tăng dần)
      arr.sort((a, b) => (a.id > b.id ? -1 : 1)); // mới nhất trước
      setFingerHistory(arr.slice(0, 8)); // chỉ lấy 8 dòng gần nhất
    });
    return () => unsubscribe();
  }, []);

  // Toggle light/pump -> ghi lên Firebase
  const handleToggleLight = () => {
    if(lightAuto) return; // nếu đang auto thì không cho toggle
    set(ref(database, "control/light"), !lightOn);
  };

  const handleTogglePump = () => {
    set(ref(database, "control/pump"), !pumpOn);
  };
  //chế độ auto
  const handleSetLightAuto = () => {
    setLightAuto(true);
    set(ref(database, "control/lightAuto"), true);
  }

  // Toggle lightAuto
  const handleSetLightManual = () => {
    setLightAuto(false);
    set(ref(database, "control/lightAuto"), false);
  };

  const handleIconToggleLight = () => {
    if(lightAuto) return; // nếu đang auto thì không cho toggle
    handleToggleLight();
  };

  const handleIconTogglePump = () => {
    handleTogglePump();
  }
  // Data cho chart
  const chartData = history.map((row) => ({
    timeLabel: row.time ? row.time.slice(11, 19) : row.id, // HH:MM:SS
    temperature: row.temperature,
    humidity: row.humidity,
  }));

  const dateStr = now.toLocaleDateString("vi-VN");
  const timeStr = now.toLocaleTimeString("vi-VN");

  return (
    <div className="dashboard-container">
      <div className="dashboard-topbar">
        <h1>Group 100 - Dashboard</h1>
        <button className="back-btn" onClick={() => navigate("/")}>
          ⬅ Quay lại Main Page
        </button>
      </div>

      <div className="dashboard-grid">
        {/* 1) Card thời gian + nhiệt độ */}
        <div className="card card-clock">
          <div className="card-clock-date">{dateStr}</div>
          <div className="card-clock-time">{timeStr}</div>
          <div className="card-clock-temp">
            {latest && latest.temperature !== undefined
              ? `${latest.temperature.toFixed(1)} °C`
              : "-- °C"}
          </div>
          <div className="card-clock-sub">
            Cập nhật cảm biến: {latest ? latest.time : "N/A"}
          </div>
        </div>

        {/* 2) Cụm độ ẩm không khí */}
        <div className="card card-humidity">
          <h2>Độ ẩm không khí</h2>
          <p className="card-big-value">
            {latest && latest.humidity !== undefined
              ? `${latest.humidity.toFixed(1)} %`
              : "-- %"}
          </p>
          <p className="card-sub">
            Lần cập nhật: {latest ? latest.time : "N/A"}
          </p>
        </div>

        {/* 3) Độ ẩm đất */}
        <div className="card card-soil">
          <h2>Độ ẩm đất</h2>
          <p className="card-big-value">
            {latest && latest.soil_moisture !== undefined
              ? `${latest.soil_moisture.toFixed(1)} %`
              : "-- %"}
          </p>
          <p className="card-sub">
            Lần cập nhật: {latest ? latest.time : "N/A"}
          </p>
        </div>

        {/* 4) Ánh sáng: Sáng / Tối */}
        <div className="card card-light">
          <h2>Ánh sáng</h2>
          <p className="card-big-value">
            {latest ? formatLight(latest.light) : "--"}
          </p>
          <p className="card-sub">
            Cảm biến quang: {latest ? formatLight(latest.light) : "N/A"}
          </p>
        </div>

        {/* 5) Điều khiển đèn & bơm */}
        <div className="card card-control">
          <h2>Điều khiển thiết bị</h2>

          {/* Hàng điều khiển ĐÈN */}
          <div className="control-tiles-row">
            {/* Tile ĐÈN */}
            <div className="device-tile device-tile-light">
              <div className="device-tile-title">Đèn</div>

              <div className="device-tile-mode-buttons">
                <button
                  type="button"
                  className={`mode-chip ${lightAuto ? "active" : ""}`}
                  onClick={handleSetLightAuto}
                >
                  <span className="mode-chip-icon">⚙️</span>
                  <span className="mode-chip-text">AUTO</span>
                </button>

                <button
                  type="button"
                  className={`mode-chip ${!lightAuto ? "active" : ""}`}
                  onClick={handleSetLightManual}
                >
                  <span className="mode-chip-icon">✋</span>
                  <span className="mode-chip-text">TAY</span>
                </button>
              </div>

            <div className="device-tile-footer">
              <div 
                className={`device-icon-btn ${lightOn ? "on" : "off"} ${
                  lightAuto ? "disabled" : ""
                }`}
                onClick={handleIconToggleLight}
              >
                💡
              </div>
              <div className="device-tile-chevron">»»</div>
            </div>
          </div>

          {/* Hàng điều khiển BƠM */}
          <div className="device-tile device-tile-pump">
            <div className="device-tile-title">Bơm</div>
            <div className="device-tile-footer">
              <div className={`device-icon-btn ${pumpOn ? "on" : "off"}`}
                onClick={handleIconTogglePump}>
                💧
              </div>
              <div className="device-tile-chevron">»»</div>
            </div>
          </div>
        </div>
        <div className="control-switches">
          {/* Hàng bật/tắt ĐÈN */}
          <div className="control-device-row">
            <span className="control-device-label">Đèn</span>
            <div className="control-device-main">
              <button
                className={`toggle-btn ${lightOn ? "on" : "off"}`}
                onClick={handleToggleLight}
                disabled={lightAuto} 
              >
              💡 {lightOn ? "Bật" : "Tắt"}
              </button>
            </div>
          </div>

          {/* Hàng bật/tắt BƠM */}
          <div className="control-device-row">
            <span className="control-device-label">Bơm</span>
            <div className="control-device-main">
              <button
                className={`toggle-btn ${pumpOn ? "on" : "off"}`}
                onClick={handleTogglePump}
              >
                💧 {pumpOn ? "Bật" : "Tắt"}
              </button>
            </div>
          </div>
        </div>
      </div>
        {/* 6) Lịch sử mở khóa vân tay */}
        <div className="card card-finger">
          <h2>Lịch sử mở khóa (vân tay)</h2>
          <table className="finger-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>ID vân tay</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {fingerHistory.map((row) => (
                <tr key={row.id}>
                  <td>{row.time}</td>
                  <td>{row.finger_id}</td>
                  <td>{row.status || "OK"}</td>
                </tr>
              ))}
              {fingerHistory.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: "center" }}>
                    Chưa có lịch sử vân tay.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 7) Biểu đồ nhiệt độ */}
        <div
          className="card card-chart card-chart-temp"
          onClick={() => setExpandedChart("temperature")}
        >
          <div className="card-chart-header">
            <h2>Biểu đồ nhiệt độ</h2>
            <span className="card-chart-hint">Nhấn để phóng to</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 8) Biểu đồ độ ẩm (nhỏ, bên phải) */}
        <div
          className="card card-chart card-chart-humidity"
          onClick={() => setExpandedChart("humidity")}
        >
          <div className="card-chart-header">
            <h2>Biểu đồ độ ẩm</h2>
            <span className="card-chart-hint">Nhấn để phóng to</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {expandedChart && (
        <div className="chart-modal" onClick={() => setExpandedChart(null)}>
          <div
            className="chart-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {expandedChart === "temperature"
                ? "Biểu đồ nhiệt độ"
                : "Biểu đồ độ ẩm"}
            </h2>
            <div className="chart-wrapper chart-wrapper-large">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeLabel" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey={
                      expandedChart === "temperature"
                        ? "temperature"
                        : "humidity"
                    }
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
