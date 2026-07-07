import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Sun, Cloud, CloudRain, Wind, Droplets, Compass, Thermometer, 
  Calendar, TrendingUp, BarChart2, Clock, Database, MapPin, AlertCircle 
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
  const [comparisonData, setComparisonData] = useState([]);
  const [activeTab, setActiveTab] = useState('hourly');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

      // 2. Fetch hourly forecast for the latest run
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

      // 4. Fetch historical comparison data
      // Group the last 3 runs and get their hourly forecasts to compare predictions
      if (runs.length > 0) {
        const topRunTimes = runs.slice(0, 3).map(r => r.update_time);
        const { data: compHourly, error: compError } = await supabase
          .from('hourly_forecast')
          .select('update_time, prediction_time, temperature')
          .in('update_time', topRunTimes)
          .order('prediction_time', { ascending: true });

        if (!compError && compHourly) {
          // Format comparison data: group by prediction_time
          const timeMap = {};
          compHourly.forEach(item => {
            const predTime = new Date(item.prediction_time).toLocaleString('vi-VN', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            if (!timeMap[predTime]) {
              timeMap[predTime] = { time: predTime };
            }
            
            // Format run time for legend
            const runLabel = new Date(item.update_time).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit'
            });
            const runDate = new Date(item.update_time).toLocaleDateString('vi-VN', {
              month: 'numeric',
              day: 'numeric'
            });
            const keyName = `Bản tin ${runLabel} (${runDate})`;
            timeMap[predTime][keyName] = parseFloat(item.temperature);
          });
          
          setComparisonData(Object.values(timeMap).slice(0, 24)); // Compare first 24 hours of predictions
        }
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Lỗi tải dữ liệu thời tiết');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to choose Lucide weather icon
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

  // Format timestamp to localized readable string
  const formatTime = (tsStr) => {
    if (!tsStr) return '';
    return new Date(tsStr).toLocaleString('vi-VN', {
      weekday: 'long',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch recent data fields safely
  const getRecentField = (field, suffix = '') => {
    if (!hourlyData || hourlyData.length === 0) return 'N/A';
    // Use the first hourly prediction as current conditions
    const current = hourlyData[0];
    const val = current[field];
    return val !== null && val !== undefined ? `${val}${suffix}` : 'N/A';
  };

  const getRecentSummary = () => {
    if (dailyData && dailyData.length > 0) {
      return dailyData[0].weather_summary;
    }
    if (hourlyData && hourlyData.length > 0) {
      return hourlyData[0].weather_summary;
    }
    return 'Mostly sunny';
  };

  // Chart data formatters
  const chartHourlyData = hourlyData.map(h => ({
    time: new Date(h.prediction_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    'Nhiệt độ (°C)': parseFloat(h.temperature) || 0,
    'Độ ẩm (%)': parseFloat(h.humidity) || 0,
    'Lượng mưa (mm)': parseFloat(h.rainfall) || 0,
    'Mây che phủ (%)': parseFloat(h.tcc) || 0
  })).slice(0, 24); // Show next 24 hours in charts

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header-wrapper">
        <div className="title-section">
          <h1>Jane's Weather Forecast Dashboard</h1>
          <p>Mô hình dự báo thời tiết 6 ngày chuyên sâu dành cho hoạt động nông nghiệp</p>
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
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="glass-card analytic-card analytic-glow">
              <div className="analytic-header">
                <span>Khả năng phun thuốc</span>
                <Clock size={16} />
              </div>
              <div className="analytic-val" style={{ color: getRecentField('spray_rating') === 'GOOD' ? 'var(--success)' : 'var(--error)' }}>
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
                      {new Date(run.update_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(run.update_time).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Tabs, Charts, and Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card">
              <div className="tabs-header">
                <button 
                  className={`tab-btn ${activeTab === 'hourly' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hourly')}
                >
                  Dự báo 24 giờ
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
                  onClick={() => setActiveTab('daily')}
                >
                  Dự báo 6 ngày tới
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'accuracy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('accuracy')}
                >
                  Phân tích dịch chuyển mô hình
                </button>
              </div>

              {/* Tab 1: Hourly Forecast */}
              {activeTab === 'hourly' && (
                <div>
                  <div className="hourly-scroll-container">
                    {hourlyData.slice(0, 24).map((h, idx) => (
                      <div className="hourly-item-card" key={idx}>
                        <div className="hourly-time">
                          {new Date(h.prediction_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(h.prediction_time).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })}
                        </div>
                        <div className="hourly-temp">{parseFloat(h.temperature)}°</div>
                        <div className="hourly-precip">{parseFloat(h.rainfall) > 0 ? `${h.rainfall}mm` : 'Không mưa'}</div>
                      </div>
                    ))}
                  </div>

                  {/* Hourly Temperature Chart */}
                  <div className="glass-card chart-card" style={{ padding: '20px 10px 0 0', background: 'transparent', boxShadow: 'none', border: 'none' }}>
                    <div className="chart-title-bar" style={{ paddingLeft: '20px' }}>
                      <h3>Biểu đồ nhiệt độ & mây che phủ trong ngày</h3>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
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
                          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} />
                          <YAxis yAxisId="left" stroke="var(--primary)" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--secondary)" fontSize={12} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: '#161c2d', borderColor: 'var(--glass-border)', color: '#fff' }} />
                          <Legend />
                          <Area yAxisId="left" type="monotone" dataKey="Nhiệt độ (°C)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                          <Area yAxisId="right" type="monotone" dataKey="Mây che phủ (%)" stroke="var(--secondary)" fillOpacity={1} fill="url(#colorTcc)" strokeWidth={1} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Hourly Rainfall Chart */}
                  <div className="glass-card chart-card" style={{ padding: '20px 10px 0 0', background: 'transparent', boxShadow: 'none', border: 'none', marginTop: '40px' }}>
                    <div className="chart-title-bar" style={{ paddingLeft: '20px' }}>
                      <h3>Biểu đồ lượng mưa lượng mưa chi tiết</h3>
                    </div>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={chartHourlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} />
                          <YAxis stroke="var(--accent)" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: '#161c2d', borderColor: 'var(--glass-border)', color: '#fff' }} />
                          <Bar dataKey="Lượng mưa (mm)" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Daily Forecast */}
              {activeTab === 'daily' && (
                <div className="daily-list">
                  {dailyData.map((d, idx) => (
                    <div className="daily-row" key={idx}>
                      <div className="daily-date">
                        {new Date(d.prediction_date).toLocaleDateString('vi-VN', {
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

              {/* Tab 3: Historical Accuracy Analysis */}
              {activeTab === 'accuracy' && (
                <div>
                  <div style={{ marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Phân tích dịch chuyển mô hình thời tiết</h3>
                    <p>
                      Mô hình Helios hiệu chỉnh dự đoán liên tục mỗi khi nạp dữ liệu mới. Biểu đồ dưới đây so sánh các đường cong nhiệt độ dự đoán cho cùng một mốc thời gian, được trích xuất từ 3 bản tin đồng bộ gần nhất. 
                      Giúp các chuyên gia nông nghiệp đánh giá sự ổn định của dự báo thời tiết trước khi ra quyết định sản xuất.
                    </p>
                  </div>

                  {comparisonData.length > 0 ? (
                    <div style={{ width: '100%', height: 350 }}>
                      <ResponsiveContainer>
                        <LineChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickFormatter={(tick) => tick.split(' ')[2]} />
                          <YAxis stroke="var(--text-secondary)" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: '#161c2d', borderColor: 'var(--glass-border)', color: '#fff' }} />
                          <Legend />
                          {Object.keys(comparisonData[0] || {})
                            .filter(k => k !== 'time')
                            .map((key, i) => {
                              const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];
                              return (
                                <Line 
                                  key={key} 
                                  type="monotone" 
                                  dataKey={key} 
                                  stroke={colors[i % colors.length]} 
                                  strokeWidth={2} 
                                  dot={false}
                                  activeDot={{ r: 6 }}
                                />
                              );
                            })
                          }
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      Cần có tối thiểu 2 bản tin dự báo được đồng bộ trong cơ sở dữ liệu để vẽ biểu đồ so sánh.
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
