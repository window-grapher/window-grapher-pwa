import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Butter from 'https://www.unpkg.com/butter-lib@1.1.0/dist.js';
import L from 'leaflet';
import './App.css';
import { initializeAuth, authIdToken, loggedInUser } from './auth';

// Leafletのデフォルトアイコン設定
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

function App() {
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [busStops, setBusStops] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // 認証を初期化
    initializeAuth();

    // butter-libを初期化
    Butter.init('https://butter.takoyaki3.com/v1.0.0/root.json', { version: '1.0.0' }).then(() => {
      // 初期化後にバス情報を取得
      fetchBuses();
    });
  }, []);

  const fetchBuses = async () => {
    try {
      const defaultLat = 35.6895;
      const defaultLon = 139.6917;

      // 周辺のリアルタイムなバス位置情報を取得
      const positions = await Butter.getRealTimePositionsByLatLon(defaultLat, defaultLon);

      console.log('取得したバスデータ:', positions); // デバッグ用

      setBuses(positions);
    } catch (error) {
      console.error('バス情報の取得中にエラーが発生しました:', error);
    }
  };

  const handleBusClick = async (bus) => {
    setSelectedBus(bus);
    try {
      const tripId = bus.trip_id || bus.tripId;
      const gtfsId = bus.gtfs_id || bus.gtfsId;
  
      if (!gtfsId) {
        console.error("gtfsIdが見つかりませんでした。");
        return;
      }
  
      const versionId = await Butter.getVersionId(gtfsId);
  
      // 停車時刻情報を取得
      const stopTimes = await Butter.getStopTimes(gtfsId, versionId);
      const tripStopTimes = stopTimes.filter((st) => st.trip_id === tripId);
  
      // 現在時刻以降の停留所のみを取得
      const now = new Date();
      const currentTimeInSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
      const upcomingStops = tripStopTimes.filter((st) => {
        const [hours, minutes, seconds] = st.arrival_time.split(':').map(Number);
        const arrivalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
        return arrivalTimeInSeconds >= currentTimeInSeconds;
      });
  
      const stopIds = upcomingStops.map((st) => st.stop_id);
      const stops = await Butter.getBusStops(gtfsId, versionId);
  
      const busStopsWithTimes = upcomingStops.map((st) => {
        const stop = stops.find((s) => s.stop_id === st.stop_id);
        return {
          ...stop,
          arrival_time: st.arrival_time,
          departure_time: st.departure_time,
        };
      });
  
      setBusStops(busStopsWithTimes);
    } catch (error) {
      console.error('停留所情報の取得中にエラーが発生しました:', error);
    }
  };

  const handleBusStopClick = async (stop) => {
    try {
      const key = `trigger@${loggedInUser.email}`;
      const created = new Date().toISOString();
      const data = {
        type: 'arrivingAtTheStop',
        triggerDetail: {
          gtfs_id: selectedBus.gtfs_id || selectedBus.gtfsId,
          trip_id: selectedBus.trip_id || selectedBus.tripId,
          stop_id: stop.stop_id,
        },
      };

      const payload = {
        key: key,
        created: created,
        data: JSON.stringify(data),
        readable: 'window-grapher@takoyaki3.com',
      };

      // kva-dynamoにリクエストを送信 (仮実装部分)
      // const response = await kvaDynamo.addItem(payload, authIdToken);

      // if (response.status === 200) {
      //   setMessage('登録が完了しました');
      // } else {
      //   setMessage('登録に失敗しました');
      // }
    } catch (error) {
      console.error('通知の登録中にエラーが発生しました:', error);
      setMessage('登録に失敗しました');
    }
  };

  return (
    <div>
      <h1>バス通知アプリ</h1>
      {message && <p>{message}</p>}
      <MapContainer center={[35.6895, 139.6917]} zoom={13} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        {buses
          .filter(
            (bus) =>
              bus?.vehicle?.position?.latitude !== undefined &&
              bus?.vehicle?.position?.longitude !== undefined
          ) // 緯度と経度が存在するバスのみ表示
          .map((bus, idx) => (
            <Marker
              key={idx}
              position={[bus.vehicle.position.latitude, bus.vehicle.position.longitude]}
              eventHandlers={{
                click: () => {
                  handleBusClick(bus);
                },
              }}
            >
              <Popup>バスID: {bus.vehicle.id || bus.vehicle.label}</Popup>
            </Marker>
          ))}
      </MapContainer>
      {selectedBus && (
        <div>
          <h2>選択したバスがこれから停車する停留所と予定到着時刻</h2>
          <ul>
            {busStops.map((stop, idx) => (
              <li key={idx}>
                {stop.stop_name} - 到着予定時刻: {stop.arrival_time}
                <button onClick={() => handleBusStopClick(stop)}>通知を登録</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
