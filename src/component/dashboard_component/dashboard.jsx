import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";

import { database } from "../../dtb/firebase";
import { ref, onValue, set } from "firebase/database";

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

  //Chu kỳ gửi dữ liệu (giây)
  const [dhtIntervalSec, setDhtIntervalSec] = useState(10);   // mặc định 10s
  const [lightIntervalSec, setLightIntervalSec] = useState(10); 
  const [soilIntervalSec, setSoilIntervalSec] = useState(10); 

  const [fingerHistory, setFingerHistory] = useState([]);
  const [now, setNow] = useState(new Date());

  // Cập nhật đồng hồ
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
      arr.sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return Number(a.id) - Number(b.id);
      });
      const all = arr.slice(-50);
      setHistory(all);
      setLatest(all[all.length - 1]);
    });
    return () => unsubscribe();
  }, []);

  // Lắng nghe control
  useEffect(() => {
    const controlRef = ref(database, "control");
    const unsubscribe = onValue(controlRef, (snapshot) => {
      const val = snapshot.val() || {};
      setLightOn(!!val.light);
      setPumpOn(!!val.pump);
      setLightAuto(val.lightAuto !== undefined ? !!val.lightAuto : true);
    });
    return () => unsubscribe();
  }, []);

  // Lắng nghe fingerHistory
  useEffect(() => {
    const fingerRef = ref(database, "fingerHistory");
    const unsubscribe = onValue(fingerRef, (snapshot) => {
      const obj = snapshot.val();
      if (!obj) {
        setFingerHistory([]);
        return;
      }
      const arr = Object.entries(obj).map(([id, row]) => ({ id, ...row }));
      arr.sort((a, b) => (a.id > b.id ? -1 : 1));
      setFingerHistory(arr.slice(0, 8));
    });
    return () => unsubscribe();
  }, []);

  //Lắng nghe device
  useEffect(() => {
    const dhtRef = ref(database, "devices/dht_1/config/sendInterval");
    const unsubscribeDht = onValue(dhtRef, (snap) => {
      const val = snap.val();
      if(typeof val === "number" && val > 0){
        setDhtIntervalSec(Math.round(val/1000));
      }
    });

    const lightRef = ref(database, "devices/light_1/config/sendInterval");
    const unsubscribeLight = onValue(lightRef, (snap) => {
      const val = snap.val();
      if(typeof val === "number" && val > 0){
        setLightIntervalSec(Math.round(val/1000));
      }
    });

    const soilRef = ref(database, "devices/soil_moisture_1/config/sendInterval");
    const unsubscribeSoil = onValue(soilRef, (snap) => {
      const val = snap.val();
      if(typeof val === "number" && val > 0){
        setSoilIntervalSec(Math.round(val/1000));
      }
    });
    return () => {
      unsubscribeDht();
      unsubscribeLight();
      unsubscribeSoil();
    };
  }, []);
  // -- HANDLERS --

  // Xử lý bật tắt Auto bằng Switch
  const handleAutoSwitch = (e) => {
    const isAuto = e.target.checked;
    setLightAuto(isAuto);
    set(ref(database, "control/lightAuto"), isAuto);
  };

  // Xử lý bật tắt Đèn bằng Switch
  const handleLightSwitch = (e) => {
    if (lightAuto) return; // Nếu đang Auto thì không làm gì (hoặc input đã disabled)
    const isOn = e.target.checked;
    set(ref(database, "control/light"), isOn);
  };

  // Xử lý bật tắt Bơm bằng Switch
  const handlePumpSwitch = (e) => {
    const isOn = e.target.checked;
    set(ref(database, "control/pump"), isOn);
  };

  const applyDhtInterval = (sec) => {
    let s = parseInt(sec, 10);
    if (isNaN(s) || s < 1) s = 1;         // tối thiểu 1s
    const ms = s * 1000;
    setDhtIntervalSec(s);
    set(ref(database, "devices/dth_1/config/sendInterval"), ms);
  };

  const applyLightInterval = (sec) => {
    let s = parseInt(sec, 10);
    if (isNaN(s) || s < 1) s = 1;
    const ms = s * 1000;
    setLightIntervalSec(s);
    set(ref(database, "devices/light_1/config/sendInterval"), ms);
  };

  const applySoilInterval = (sec) => {
    let s = parseInt(sec, 10);
    if (isNaN(s) || s < 1) s = 1;
    const ms = s * 1000;
    setSoilIntervalSec(s);
    set(ref(database, "devices/soil_moisture_1/config/sendInterval"), ms);
  };

  const chartData = history.map((row) => ({
    timeLabel: row.time ? row.time.slice(11, 19) : row.id,
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
        {/* 1) Card thời gian */}
        <div className="card card-clock">
          <div className="card-clock-date">{dateStr}</div>
          <div className="card-clock-time">{timeStr}</div>
          <div className="card-clock-temp">
            {latest && latest.temperature !== undefined
              ? `${latest.temperature.toFixed(1)} °C`
              : "-- °C"}
          </div>
          <div className="card-clock-sub">
            Cập nhật: {latest ? latest.time : "N/A"}
          </div>
        </div>

        {/* 2) Độ ẩm KK */}
        <div className="card card-humidity">
          <h2>Độ ẩm không khí</h2>
          <p className="card-big-value">
            {latest && latest.humidity !== undefined
              ? `${latest.humidity.toFixed(1)} %`
              : "-- %"}
          </p>
          <p className="card-sub">
            Cập nhật: {latest ? latest.time : "N/A"}
          </p>
          <div className="config-row">
            <span className="config-label">Chu kỳ gửi:</span>
            <input
              type="number"
              min={1}
              max={3600}
              value={dhtIntervalSec}
              onChange={(e) => setDhtIntervalSec(e.target.value)}
              onBlur={(e) => applyDhtInterval(e.target.value)}
              className="config-input"
            />
            <span className="config-unit">giây</span>
          </div>
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
            Cập nhật: {latest ? latest.time : "N/A"}
          </p>
          <div className="config-row">
            <span className="config-label">Chu kỳ gửi:</span>
            <input
              type="number"
              min={1}
              max={3600}
              value={soilIntervalSec}
              onChange={(e) => setSoilIntervalSec(e.target.value)}
              onBlur={(e) => applySoilInterval(e.target.value)}
              className="config-input"
            />
            <span className="config-unit">giây</span>
          </div>
        </div>

        {/* 4) Ánh sáng */}
        <div className="card card-light">
          <h2>Ánh sáng</h2>
          <p className="card-big-value">
            {latest ? formatLight(latest.light) : "--"}
          </p>
          <p className="card-sub">Trạng thái: {latest ? formatLight(latest.light) : "N/A"}
          </p>
          <div className="config-row">
            <span className="config-label">Chu kỳ gửi:</span>
            <input
              type="number"
              min={1}
              max={3600}
              value={lightIntervalSec}
              onChange={(e) => setLightIntervalSec(e.target.value)}
              onBlur={(e) => applyLightInterval(e.target.value)}
              className="config-input"
            />
            <span className="config-unit">giây</span>
          </div>
        </div>

        {/* 5) ĐIỀU KHIỂN*/}
        <div className="card card-control">
          <h2>Điều khiển thiết bị</h2>

          <div className="control-tiles-row">
            {/* Tile ĐÈN: Có 2 switch (Auto và Nguồn) */}
            <div className="device-tile device-tile-light">
              <div className="device-tile-title">Hệ thống Đèn</div>
              
              {/* Switch 1: Chế độ Tự động */}
              <div className="switch-row">
                <span className="switch-label">
                  <span className="switch-icon">⚙️</span> AUTO
                </span>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={lightAuto} 
                    onChange={handleAutoSwitch} 
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Switch 2: Bật/Tắt Đèn (Disable nếu đang Auto) */}
              <div className="switch-row">
                <span className="switch-label">
                  <span className="switch-icon">💡</span> Đèn
                </span>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={lightOn} 
                    onChange={handleLightSwitch}
                    disabled={lightAuto}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            {/* Tile BƠM: Chỉ có 1 switch Nguồn */}
            <div className="device-tile device-tile-pump">
              <div className="device-tile-title">Hệ thống Bơm</div>
              
              <div className="switch-row" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
                <span className="switch-label">
                  <span className="switch-icon">💧</span> Bơm nước
                </span>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={pumpOn} 
                    onChange={handlePumpSwitch} 
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 6) Lịch sử vân tay */}
        <div className="card card-finger">
          <h2>Lịch sử mở khóa (vân tay)</h2>
          <div className="table-container">
            <table className="finger-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>ID</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {fingerHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.time}</td>
                    <td>{row.finger_id === -1 ? "Người lạ" : row.finger_id}</td>
                    <td>
                      <span className={`status-badge ${row.status === "OK" ? "ok" : "fail"}`}>
                        {row.status || "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
                {fingerHistory.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center" }}>
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7 & 8) Biểu đồ */}
        <div
          className="card card-chart card-chart-temp"
          onClick={() => setExpandedChart("temperature")}
        >
          <div className="card-chart-header">
            <h2>Nhiệt độ</h2>
            <span className="card-chart-hint">Phóng to</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" hide />
                <YAxis width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="temperature" stroke="#ff7300" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="card card-chart card-chart-humidity"
          onClick={() => setExpandedChart("humidity")}
        >
          <div className="card-chart-header">
            <h2>Độ ẩm</h2>
            <span className="card-chart-hint">Phóng to</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" hide />
                <YAxis width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="humidity" stroke="#387908" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Modal phóng to biểu đồ */}
      {expandedChart && (
        <div className="chart-modal" onClick={() => setExpandedChart(null)}>
          <div className="chart-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{expandedChart === "temperature" ? "Biểu đồ nhiệt độ" : "Biểu đồ độ ẩm"}</h2>
            <div className="chart-wrapper chart-wrapper-large">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeLabel" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey={expandedChart === "temperature" ? "temperature" : "humidity"}
                    stroke={expandedChart === "temperature" ? "#ff7300" : "#387908"}
                    dot={false}
                    strokeWidth={2}
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