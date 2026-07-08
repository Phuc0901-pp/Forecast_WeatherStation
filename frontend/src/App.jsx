import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Sun, Cloud, CloudRain, Wind, Droplets, Compass, Thermometer, 
  Calendar, TrendingUp, BarChart2, Clock, Database, MapPin, AlertCircle, Info
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, LineChart, Line, Legend, BarChart, Bar 
} from 'recharts';

export default function App() {
  const [latestRun, setLatestRun] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [historicalRuns, setHistoricalRuns] = useState([]);
  const [activeTab, setActiveTab] = useState('hourly');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Spray Suitability States
  const [selectedSprayDay, setSelectedSprayDay] = useState(null);

  // Historical Prediction Evolution States
  const [predictionTimesList, setPredictionTimesList] = useState([]);
  const [selectedPredictionTime, setSelectedPredictionTime] = useState('');
  const [evolutionData, setEvolutionData] = useState([]);
  const [isExportingAll, setIsExportingAll] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch latest forecast run
      const { data: runs, error: runError } = await supabase
        .from('weather_forecast_run')
        .select('*')
        .order('update_time', { ascending: false });

      if (runError) throw runError;
      if (!runs || runs.length === 0) {
        setIsLoading(false);
        return;
      }

      const latest = runs[0];
      setLatestRun(latest);
      setHistoricalRuns(runs);

      // 2. Fetch ALL hourly forecast entries for the latest run
      const { data: hourly, error: hourlyError } = await supabase
        .from('hourly_forecast')
        .select('*')
        .eq('update_time', latest.update_time)
        .order('prediction_time', { ascending: true });

      if (hourlyError) throw hourlyError;
      setHourlyData(hourly || []);

      // 3. Fetch daily forecast for the latest run
      const { data: daily, error: dailyError } = await supabase
        .from('daily_forecast')
        .select('*')
        .eq('update_time', latest.update_time)
        .order('prediction_date', { ascending: true });

      if (dailyError) throw dailyError;
      setDailyData(daily || []);
      
      if (daily && daily.length > 0) {
        setSelectedSprayDay(daily[0].prediction_date);
      }

      // 4. Fallback query for prediction times list
      const { data: fallbackTimes } = await supabase
        .from('hourly_forecast')
        .select('prediction_time')
        .order('prediction_time', { ascending: true });
      
      if (fallbackTimes) {
        const unique = [...new Set(fallbackTimes.map(item => item.prediction_time))];
        setPredictionTimesList(unique.slice(0, 40)); 
        if (unique.length > 0) {
          setSelectedPredictionTime(unique[0]);
        }
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Lỗi tải dữ liệu thời tiết');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch prediction evolution data
  useEffect(() => {
    if (selectedPredictionTime) {
      fetchEvolutionData(selectedPredictionTime);
    }
  }, [selectedPredictionTime]);

  const fetchEvolutionData = async (predTime) => {
    try {
      const { data, error } = await supabase
        .from('hourly_forecast')
        .select('update_time, temperature, wind_speed, rainfall, spray_rating')
        .eq('prediction_time', predTime)
        .order('update_time', { ascending: true });

      if (error) throw error;
      
      const formatted = (data || []).map((item, idx) => {
        const runTime = new Date(item.update_time);
        const tempVal = parseFloat(item.temperature) || 0;
        const windVal = parseFloat(item.wind_speed) || 0;
        const rainVal = parseFloat(item.rainfall) || 0;
        
        let tempDeltaPrev = 0;
        let tempDeltaOrigin = 0;
        let windDeltaPrev = 0;
        let windDeltaOrigin = 0;
        let rainDeltaPrev = 0;
        let rainDeltaOrigin = 0;

        if (idx > 0) {
          const prev = data[idx - 1];
          const origin = data[0];
          
          tempDeltaPrev = tempVal - (parseFloat(prev.temperature) || 0);
          tempDeltaOrigin = tempVal - (parseFloat(origin.temperature) || 0);
          
          windDeltaPrev = windVal - (parseFloat(prev.wind_speed) || 0);
          windDeltaOrigin = windVal - (parseFloat(origin.wind_speed) || 0);
          
          rainDeltaPrev = rainVal - (parseFloat(prev.rainfall) || 0);
          rainDeltaOrigin = rainVal - (parseFloat(origin.rainfall) || 0);
        }

        return {
          runTimeStr: runTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) + ' (' + runTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'numeric', day: 'numeric' }) + ')',
          temp: tempVal,
          tempDeltaPrev: tempDeltaPrev,
          tempDeltaOrigin: tempDeltaOrigin,
          wind: windVal,
          windDeltaPrev: windDeltaPrev,
          windDeltaOrigin: windDeltaOrigin,
          rain: rainVal,
          rainDeltaPrev: rainDeltaPrev,
          rainDeltaOrigin: rainDeltaOrigin,
          sprayRating: item.spray_rating
        };
      });
      setEvolutionData(formatted);
    } catch (err) {
      console.error('Error fetching evolution:', err);
    }
  };

  const getWeatherIcon = (iconName) => {
    const name = (iconName || '').toUpperCase();
    if (name.includes('RAIN') || name.includes('SHOWER')) {
      return <CloudRain className="weather-icon-large" />;
    }
    if (name.includes('CLOUD')) {
      return <Cloud className="weather-icon-large" />;
    }
    return <Sun className="weather-icon-large" />;
  };

  const formatDateLabel = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric'
    });
  };

  const getRecentField = (field, suffix = '') => {
    if (!hourlyData || hourlyData.length === 0) return 'N/A';
    const current = hourlyData[0];
    const val = current[field];
    return val !== null && val !== undefined ? `${val}${suffix}` : 'N/A';
  };

  const getRecentSummary = () => {
    if (dailyData && dailyData.length > 0) return dailyData[0].weather_summary;
    if (hourlyData && hourlyData.length > 0) return hourlyData[0].weather_summary;
    return 'Mostly sunny';
  };

  const getRatingColor = (rating) => {
    const r = (rating || '').toUpperCase();
    if (r === 'GOOD') return 'var(--success)';
    if (r === 'MARGINAL') return 'var(--warning)';
    return 'var(--error)';
  };

  // Export 1-hour target history to CSV
  const handleExportCSV = () => {
    if (evolutionData.length === 0) return;
    
    const csvRows = [
      [
        'Target Prediction Time',
        'Update Time (Run Time)',
        'Predicted Temp (C)',
        'Temp Delta vs Previous Run (C)',
        'Temp Delta vs First Run (C)',
        'Predicted Wind Speed (km/h)',
        'Wind Delta vs Previous Run (km/h)',
        'Wind Delta vs First Run (km/h)',
        'Predicted Rainfall (mm)',
        'Rain Delta vs Previous Run (mm)',
        'Rain Delta vs First Run (mm)',
        'Spray Rating'
      ]
    ];

    evolutionData.forEach((item, idx) => {
      csvRows.push([
        selectedPredictionTime,
        item.runTimeStr.replace(/,/g, ''),
        item.temp,
        idx === 0 ? 0 : item.tempDeltaPrev.toFixed(1),
        idx === 0 ? 0 : item.tempDeltaOrigin.toFixed(1),
        item.wind,
        idx === 0 ? 0 : item.windDeltaPrev.toFixed(1),
        idx === 0 ? 0 : item.windDeltaOrigin.toFixed(1),
        item.rain,
        idx === 0 ? 0 : item.rainDeltaPrev.toFixed(1),
        idx === 0 ? 0 : item.rainDeltaOrigin.toFixed(1),
        item.sprayRating
      ]);
    });

    const csvContent = "\uFEFF" + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const formattedPredTime = new Date(selectedPredictionTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'numeric' }).replace(/\//g, '-');
    const formattedHour = new Date(selectedPredictionTime).getHours();
    
    link.setAttribute("download", `lich_su_du_bao_target_${formattedHour}h_ngay_${formattedPredTime}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export ENTIRE database predictions and deltas to CSV
  const handleExportAllCSV = async () => {
    setIsExportingAll(true);
    try {
      const { data, error } = await supabase
        .from('hourly_forecast')
        .select('*')
        .order('prediction_time', { ascending: true })
        .order('update_time', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Không có dữ liệu để xuất');
        return;
      }

      const csvRows = [
        [
          'Target Prediction Time (Moc gio du bao)',
          'Update Time (Thoi diem cao du lieu)',
          'Predicted Temp (C)',
          'Temp Delta vs Previous Run (C)',
          'Temp Delta vs First Run (C)',
          'Predicted Wind Speed (km/h)',
          'Wind Delta vs Previous Run (km/h)',
          'Wind Delta vs First Run (km/h)',
          'Predicted Rainfall (mm)',
          'Rain Delta vs Previous Run (mm)',
          'Rain Delta vs First Run (mm)',
          'Overall Spray Rating',
          'Temp Spray Rating',
          'Wind Spray Rating',
          'Cloud Spray Rating',
          'Delta T Spray Rating'
        ]
      ];

      const groups = {};
      data.forEach(item => {
        if (!groups[item.prediction_time]) {
          groups[item.prediction_time] = [];
        }
        groups[item.prediction_time].push(item);
      });

      Object.keys(groups).forEach(predTime => {
        const groupRecords = groups[predTime];
        
        groupRecords.forEach((item, idx) => {
          const tempVal = parseFloat(item.temperature) || 0;
          const windVal = parseFloat(item.wind_speed) || 0;
          const rainVal = parseFloat(item.rainfall) || 0;

          let tempDeltaPrev = 0;
          let tempDeltaOrigin = 0;
          let windDeltaPrev = 0;
          let windDeltaOrigin = 0;
          let rainDeltaPrev = 0;
          let rainDeltaOrigin = 0;

          if (idx > 0) {
            const prev = groupRecords[idx - 1];
            const origin = groupRecords[0];

            tempDeltaPrev = tempVal - (parseFloat(prev.temperature) || 0);
            tempDeltaOrigin = tempVal - (parseFloat(origin.temperature) || 0);

            windDeltaPrev = windVal - (parseFloat(prev.wind_speed) || 0);
            windDeltaOrigin = windVal - (parseFloat(origin.wind_speed) || 0);

            rainDeltaPrev = rainVal - (parseFloat(prev.rainfall) || 0);
            rainDeltaOrigin = rainVal - (parseFloat(origin.rainfall) || 0);
          }

          const formattedPredTime = new Date(item.prediction_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const formattedUpdateTime = new Date(item.update_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

          csvRows.push([
            formattedPredTime,
            formattedUpdateTime.replace(/,/g, ''),
            tempVal,
            idx === 0 ? 0 : tempDeltaPrev.toFixed(1),
            idx === 0 ? 0 : tempDeltaOrigin.toFixed(1),
            windVal,
            idx === 0 ? 0 : windDeltaPrev.toFixed(1),
            idx === 0 ? 0 : windDeltaOrigin.toFixed(1),
            rainVal,
            idx === 0 ? 0 : rainDeltaPrev.toFixed(1),
            idx === 0 ? 0 : rainDeltaOrigin.toFixed(1),
            item.spray_rating || 'N/A',
            item.temp_spray_rating || 'GOOD',
            item.wind_spray_rating || 'GOOD',
            item.tcc_spray_rating || 'GOOD',
            item.delta_t_spray_rating || 'GOOD'
          ]);
        });
      });

      const csvContent = "\uFEFF" + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const fileDate = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/\//g, '-');
      link.setAttribute("download", `bao_cao_toan_bo_du_bao_ngay_${fileDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting all forecast data:', err);
      alert('Lỗi xuất toàn bộ dữ liệu: ' + err.message);
    } finally {
      setIsExportingAll(false);
    }
  };

  const sprayHourlyFiltered = hourlyData.filter(h => {
    if (!selectedSprayDay) return false;
    const predDate = h.prediction_time.split('T')[0];
    return predDate === selectedSprayDay;
  });

  const chartHourlyData = hourlyData.map(h => ({
    time: new Date(h.prediction_time).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }),
    'Nhiệt độ (°C)': parseFloat(h.temperature) || 0,
    'Độ ẩm (%)': parseFloat(h.humidity) || 0,
    'Lượng mưa (mm)': parseFloat(h.rainfall) || 0,
    'Khả năng mưa (%)': parseFloat(h.rainfall_probability) || 0,
    'Mây che phủ (%)': parseFloat(h.tcc) || 0
  })).slice(0, 48); // Show 48 hours trend

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header-wrapper">
        <div className="title-section" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img 
            src="/logo.png" 
            alt="TanBao AgTech Logo" 
            style={{ height: '65px', width: 'auto', objectFit: 'contain', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '8px' }} 
          />
          <div>
            <h1 style={{ margin: 0 }}>Jane's Weather Forecast Dashboard</h1>
            <p>Mô hình dự báo thời tiết 6 ngày chuyên sâu dành cho hoạt động nông nghiệp</p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="status-badge loading">
            <Clock className="animate-spin" size={16} />
            Đang đồng bộ...
          </div>
        ) : (
          <div className="status-badge">
            <Database size={16} />
            Supabase Live
          </div>
        )}
      </header>

      {error && (
        <div className="glass-card" style={{ borderColor: 'var(--error)', display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--error)', marginBottom: '30px' }}>
          <AlertCircle />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !latestRun && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <AlertCircle size={48} style={{ color: 'var(--warning)', marginBottom: '16px' }} />
          <h2>Chưa có dữ liệu lịch sử dự báo</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Vui lòng khởi chạy chương trình Go collector để bắt đầu đồng bộ dữ liệu thời tiết về Supabase.
          </p>
        </div>
      )}

      {latestRun && (
        <div className="dashboard-grid">
          {/* Left Panel: Current Weather */}
          <div className="sidebar-panel">
            <div className="glass-card current-card">
              <div className="current-card-content">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <MapPin size={14} />
                  <span>{latestRun.location}</span>
                </div>
                
                {getWeatherIcon(hourlyData[0]?.weather_icon)}
                
                <div className="temp-large">{getRecentField('temperature', '°')}</div>
                <div className="weather-precis">{hourlyData[0]?.weather_summary}</div>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: '16px 0' }}>
                  {getRecentSummary()}
                </p>

                <div className="weather-meta-mini-grid">
                  <div className="meta-mini-item">
                    <span className="meta-mini-label">Lượng mưa</span>
                    <span className="meta-mini-value" style={{ color: 'var(--accent)' }}>{getRecentField('rainfall', ' mm')}</span>
                  </div>
                  <div className="meta-mini-item">
                    <span className="meta-mini-label">Khả năng mưa</span>
                    <span className="meta-mini-value" style={{ color: 'var(--accent)' }}>{getRecentField('rainfall_probability', ' %')}</span>
                  </div>
                  <div className="meta-mini-item">
                    <span className="meta-mini-label">Độ ẩm</span>
                    <span className="meta-mini-value">{getRecentField('humidity', ' %')}</span>
                  </div>
                  <div className="meta-mini-item">
                    <span className="meta-mini-label">Sức gió</span>
                    <span className="meta-mini-value">{getRecentField('wind_speed', ' km/h')}</span>
                  </div>
                  <div className="meta-mini-item">
                    <span className="meta-mini-label">Mây che phủ</span>
                    <span className="meta-mini-value">{getRecentField('tcc', ' %')}</span>
                  </div>
                  <div className="meta-mini-item">
                    <span className="meta-mini-label">Điểm sương</span>
                    <span className="meta-mini-value">{getRecentField('dew_point', '°C')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="glass-card analytic-card analytic-glow">
              <div className="analytic-header">
                <span>Khả năng phun thuốc</span>
                <Clock size={16} />
              </div>
              <div className="analytic-val" style={{ color: getRatingColor(getRecentField('spray_rating')) }}>
                {getRecentField('spray_rating')}
              </div>
              <span className="analytic-desc">Được tính toán dựa trên mức độ gió và delta T để phun xịt thuốc hiệu quả.</span>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} />
                Lịch sử nạp dữ liệu
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                {historicalRuns.slice(0, 5).map((run, idx) => (
                  <div key={run.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 8px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px' }}>
                    <span style={{ color: idx === 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                      {idx === 0 ? 'Mới nhất' : `Bản tin #${historicalRuns.length - idx}`}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(run.update_time).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} ({new Date(run.update_time).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'numeric', day: 'numeric' })})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card">
              <div className="tabs-header">
                <button 
                  className={`tab-btn ${activeTab === 'hourly' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hourly')}
                >
                  Đồ thị xu hướng 48 giờ
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
                  onClick={() => setActiveTab('daily')}
                >
                  Dự báo 6 ngày tới
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'spray' ? 'active' : ''}`}
                  onClick={() => setActiveTab('spray')}
                >
                  Chi tiết điều kiện phun thuốc
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'accuracy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('accuracy')}
                >
                  Lịch sử thay đổi dự đoán
                </button>
              </div>

              {/* Tab 1: Hourly Trends Charts */}
              {activeTab === 'hourly' && (
                <div>
                  <div className="glass-card chart-card" style={{ padding: '20px 10px 0 0', background: 'transparent', boxShadow: 'none', border: 'none' }}>
                    <div className="chart-title-bar" style={{ paddingLeft: '20px' }}>
                      <h3>Biểu đồ nhiệt độ & mây che phủ (48 giờ tiếp theo)</h3>
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <AreaChart data={chartHourlyData}>
                          <defs>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorTcc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickFormatter={(tick) => tick.split(' ')[0]} />
                          <YAxis yAxisId="left" stroke="var(--primary)" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--secondary)" fontSize={12} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: '#f0f7f3', borderColor: 'var(--glass-border)', color: '#0f172a' }} />
                          <Legend />
                          <Area yAxisId="left" type="monotone" name="Nhiệt độ (°C)" dataKey="Nhiệt độ (°C)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                          <Area yAxisId="right" type="monotone" name="Mây che phủ (%)" dataKey="Mây che phủ (%)" stroke="var(--secondary)" fillOpacity={1} fill="url(#colorTcc)" strokeWidth={1} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-card chart-card" style={{ padding: '20px 10px 0 0', background: 'transparent', boxShadow: 'none', border: 'none', marginTop: '30px' }}>
                    <div className="chart-title-bar" style={{ paddingLeft: '20px' }}>
                      <h3>Biểu đồ lượng mưa & khả năng mưa</h3>
                    </div>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={chartHourlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickFormatter={(tick) => tick.split(' ')[0]} />
                          <YAxis yAxisId="left" stroke="var(--accent)" fontSize={12} label={{ value: 'Lượng mưa (mm)', angle: -90, position: 'insideLeft', style: { fill: 'var(--accent)' } }} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--secondary)" fontSize={12} label={{ value: 'Khả năng mưa (%)', angle: 90, position: 'insideRight', style: { fill: 'var(--secondary)' } }} />
                          <Tooltip contentStyle={{ backgroundColor: '#f0f7f3', borderColor: 'var(--glass-border)', color: '#0f172a' }} />
                          <Legend />
                          <Bar yAxisId="left" name="Lượng mưa (mm)" dataKey="Lượng mưa (mm)" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" name="Khả năng mưa (%)" dataKey="Khả năng mưa (%)" fill="var(--secondary)" radius={[4, 4, 0, 0]} opacity={0.6} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Daily Summary */}
              {activeTab === 'daily' && (
                <div className="daily-list">
                  {dailyData.map((d, idx) => (
                    <div className="daily-row" key={idx}>
                      <div className="daily-date">
                        {new Date(d.prediction_date).toLocaleDateString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                          weekday: 'long',
                          month: 'numeric',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="daily-temps">
                        <span className="daily-temp-max">{parseFloat(d.temperature_max)}°</span>
                        <span className="daily-temp-min">{d.temperature_min !== null ? `${parseFloat(d.temperature_min)}°` : 'N/A'}</span>
                      </div>
                      <div className="daily-summary">
                        {d.weather_summary}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {d.day_icon_precis || 'Sunny'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Detailed Spray Suitability Table */}
              {activeTab === 'spray' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {dailyData.map(d => (
                      <button
                        key={d.prediction_date}
                        className={`tab-btn ${selectedSprayDay === d.prediction_date ? 'active' : ''}`}
                        onClick={() => setSelectedSprayDay(d.prediction_date)}
                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                      >
                        {formatDateLabel(d.prediction_date)}
                      </button>
                    ))}
                  </div>

                  {sprayHourlyFiltered.length > 0 ? (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(16,185,129,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '16px 20px', fontWeight: 600 }}>Thời gian</th>
                            <th style={{ padding: '16px 20px', fontWeight: 600 }}>Đánh giá chung</th>
                            <th style={{ padding: '16px 20px', fontWeight: 600 }}>Nhiệt độ</th>
                            <th style={{ padding: '16px 20px', fontWeight: 600 }}>Sức gió</th>
                            <th style={{ padding: '16px 20px', fontWeight: 600 }}>Lượng mây</th>
                            <th style={{ padding: '16px 20px', fontWeight: 600 }}>Delta T</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sprayHourlyFiltered.map((h, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.05)' }}>
                              <td style={{ padding: '14px 20px', fontWeight: 500 }}>
                                {new Date(h.prediction_time).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td style={{ padding: '14px 20px', color: getRatingColor(h.spray_rating), fontWeight: 700 }}>
                                {h.spray_rating}
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ color: getRatingColor(h.temp_spray_rating), fontWeight: 600 }}>{h.temp_spray_rating || 'GOOD'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '6px' }}>({h.temperature}°)</span>
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ color: getRatingColor(h.wind_spray_rating), fontWeight: 600 }}>{h.wind_spray_rating || 'GOOD'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '6px' }}>({h.wind_speed} km/h)</span>
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ color: getRatingColor(h.tcc_spray_rating), fontWeight: 600 }}>{h.tcc_spray_rating || 'GOOD'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '6px' }}>({h.tcc})</span>
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ color: getRatingColor(h.delta_t_spray_rating), fontWeight: 600 }}>{h.delta_t_spray_rating || 'GOOD'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '6px' }}>({h.delta_t})</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      Không có chi tiết dữ liệu phun xịt thuốc cho ngày này.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Target-hour Prediction Evolution */}
              {activeTab === 'accuracy' && (
                <div>
                  <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.1)', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Info style={{ color: 'var(--primary)', flexShrink: 0 }} size={20} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      <strong>Trực quan hóa sự thay đổi dự báo:</strong> Chọn một mốc giờ cụ thể dưới đây. 
                      Đồ thị sẽ vẽ lại toàn bộ các giá trị dự báo cho mốc giờ này qua các phiên đồng bộ khác nhau. 
                      Bạn sẽ thấy dự báo biến động, tăng hay giảm như thế nào trước khi chính thức diễn ra.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Mốc giờ dự đoán mục tiêu:</span>
                      <select
                        value={selectedPredictionTime}
                        onChange={(e) => setSelectedPredictionTime(e.target.value)}
                        style={{
                          background: '#ffffff',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--glass-border)',
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'inherit',
                          fontSize: '0.9rem',
                          cursor: 'pointer'
                        }}
                      >
                        {predictionTimesList.map(t => (
                          <option key={t} value={t}>
                            {new Date(t).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date(t).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={handleExportCSV}
                        className="tab-btn active"
                        style={{
                          padding: '10px 20px',
                          fontSize: '0.9rem',
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--secondary)',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        Xuất mốc giờ này (CSV)
                      </button>

                      <button
                        onClick={handleExportAllCSV}
                        disabled={isExportingAll}
                        className="tab-btn active"
                        style={{
                          padding: '10px 20px',
                          fontSize: '0.9rem',
                          background: 'var(--primary)',
                          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        {isExportingAll ? 'Đang trích xuất...' : 'Xuất toàn bộ dữ liệu (CSV)'}
                      </button>
                    </div>
                  </div>

                  {evolutionData.length > 0 ? (
                    <div>
                      {/* Evolution Chart */}
                      <div style={{ width: '100%', height: 280, marginBottom: '30px' }}>
                        <ResponsiveContainer>
                          <LineChart data={evolutionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="runTimeStr" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-secondary)" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: '#f0f7f3', borderColor: 'var(--glass-border)', color: '#0f172a' }} />
                            <Legend />
                            <Line type="monotone" name="Nhiệt độ dự báo (°C)" dataKey="temp" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
                            <Line type="monotone" name="Sức gió dự báo (km/h)" dataKey="wind" stroke="var(--secondary)" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Evolution Table */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Bảng lịch sử biến động dự đoán</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Chú thích độ lệch: <strong>(Δ Lần cào trước / Δ Lần cào đầu tiên)</strong>
                        </span>
                      </div>
                      
                      <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(16,185,129,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Thời điểm cào dữ liệu (Update Time)</th>
                              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Nhiệt độ dự báo</th>
                              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Sức gió dự báo</th>
                              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Lượng mưa dự báo</th>
                              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Khả năng phun thuốc</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evolutionData.map((item, idx) => {
                              const formatDelta = (val) => {
                                if (idx === 0) return '';
                                if (val > 0) return `+${val.toFixed(1)}`;
                                if (val < 0) return `${val.toFixed(1)}`;
                                return '0';
                              };
                              const tempPrevStr = formatDelta(item.tempDeltaPrev);
                              const tempOriginStr = formatDelta(item.tempDeltaOrigin);
                              const windPrevStr = formatDelta(item.windDeltaPrev);
                              const windOriginStr = formatDelta(item.windDeltaOrigin);
                              const rainPrevStr = formatDelta(item.rainDeltaPrev);
                              const rainOriginStr = formatDelta(item.rainDeltaOrigin);

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.05)' }}>
                                  <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{item.runTimeStr}</td>
                                  <td style={{ padding: '12px 20px', fontWeight: 700 }}>
                                    {item.temp}°C
                                    {idx > 0 && (
                                      <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: 500 }}>
                                        (<span style={{ color: item.tempDeltaPrev >= 0 ? 'var(--success)' : 'var(--error)' }}>{tempPrevStr}</span> / <span style={{ color: item.tempDeltaOrigin >= 0 ? 'var(--success)' : 'var(--error)' }}>{tempOriginStr}</span>)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 20px' }}>
                                    {item.wind} km/h
                                    {idx > 0 && (
                                      <span style={{ fontSize: '0.75rem', marginLeft: '6px' }}>
                                        (<span style={{ color: item.windDeltaPrev >= 0 ? 'var(--success)' : 'var(--error)' }}>{windPrevStr}</span> / <span style={{ color: item.windDeltaOrigin >= 0 ? 'var(--success)' : 'var(--error)' }}>{windOriginStr}</span>)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 20px', color: 'var(--accent)' }}>
                                    {item.rain} mm
                                    {idx > 0 && (
                                      <span style={{ fontSize: '0.75rem', marginLeft: '6px' }}>
                                        (<span style={{ color: item.rainDeltaPrev >= 0 ? 'var(--success)' : 'var(--error)' }}>{rainPrevStr}</span> / <span style={{ color: item.rainDeltaOrigin >= 0 ? 'var(--success)' : 'var(--error)' }}>{rainOriginStr}</span>)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 20px', color: getRatingColor(item.sprayRating), fontWeight: 700 }}>{item.sprayRating}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      Không có đủ dữ liệu lịch sử để phân tích biến động cho mốc giờ này.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
