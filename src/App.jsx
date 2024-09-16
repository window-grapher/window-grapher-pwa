import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Butter from 'https://www.unpkg.com/butter-lib@1.1.0/dist.js';
import L from 'leaflet';
import './App.css';
import axios from 'axios';
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
    Butter.init().then(() => {
      fetchBuses();
    });
  }, []);

  const fetchBuses = async () => {
    try {
      const defaultLat = 26.223300;
      const defaultLon = 127.691028;

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
    
    // busオブジェクトをコンソールに出力して構造を確認
    console.log("選択したバスのデータ:", bus);
  
    try {
      // 固定されたGTFS-ID
      const gtfsId = 'yanbaru-expressbus'; // 実際のGTFS-IDに置き換えてください
  
      // busオブジェクトの中にどのフィールドに tripId があるか確認
      const tripId = bus.vehicle.trip.tripId;
  
      if (!tripId) {
        console.error("tripIdが見つかりませんでした。");
        return;
      }
      console.log("使用する tripId:", tripId);
  
      const versionId = await Butter.getVersionId(gtfsId);
      console.log("使用する versionId:", versionId);
  
      // 停車時刻情報を取得
      const stopTimes = await Butter.getStopTimes(gtfsId, versionId);
      console.log("取得した stopTimes:", stopTimes);
  
      const tripStopTimes = stopTimes.filter((st) => st.trip_id === tripId);
      console.log("tripId に一致する tripStopTimes:", tripStopTimes);
  
      if (tripStopTimes.length === 0) {
        console.error("該当する tripStopTimes が見つかりませんでした。");
        return;
      }
  
      const now = new Date();
      const currentTimeInSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
      const upcomingStops = tripStopTimes.filter((st) => {
        const [hours, minutes, seconds] = st.arrival_time.split(':').map(Number);
        const arrivalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
        return arrivalTimeInSeconds >= currentTimeInSeconds;
      });
      console.log("現在時刻以降の upcomingStops:", upcomingStops);
  
      if (upcomingStops.length === 0) {
        console.error("現在時刻以降の停留所が見つかりませんでした。");
        return;
      }
  
      const stops = await Butter.getBusStops(gtfsId, versionId);
      console.log("取得したバス停情報:", stops);
  
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
          trip_id: selectedBus.vehicle.trip.tripId, // trip_idを正しく取得して登録
          stop_id: stop.stop_id,
        },
      };

      const payload = {
        key: key,
        created: created,
        data: JSON.stringify(data),
        readable: 'window-grapher@takoyaki3.com',
      };

      console.log({authIdToken, payload});

      // REST APIにリクエストを送信
      const response = await axios.post('https://mfp6wj7mv6mf45q6o3tse7v4oe0gzgrp.lambda-url.ap-northeast-1.on.aws/', payload, {
        headers: {
          Authorization: `Bearer ${authIdToken}`,
        },
      });
      if (response.status === 200) {
        setMessage('登録が完了しました');
      } else {
        setMessage('登録に失敗しました');
      }
    } catch (error) {
      console.error('通知の登録中にエラーが発生しました:', error);
      setMessage('登録に失敗しました');
    }
  };

  return (
    <div>
      <h1>バス通知アプリ</h1>
      {message && <p>{message}</p>}
      <MapContainer center={[26.228682, 127.683985]} zoom={13} style={{ height: '500px', width: '100%' }}>
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
