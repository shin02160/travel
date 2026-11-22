import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../icons.jsx';
import './TravelGallery.css';

const TYPES = ['공연', '음식', '숙소', '이동', '풍경', '기타'];

function Photo({ photo, lazy = false }) {
  const [failed, setFailed] = useState(false);
  if (!photo.src || failed) {
    return (
      <span className="travel-photo-fallback">
        <span aria-hidden="true"><Icon name="image" size={28} /></span>
        <span>사진을 표시할 수 없습니다.</span>
      </span>
    );
  }
  return <img src={photo.src} alt={photo.title} loading={lazy ? 'lazy' : 'eager'} decoding="async"
    onError={() => setFailed(true)} />;
}

function PhotoMeta({ photo }) {
  return (
    <span className="travel-photo-meta">
      {photo.shotAt && <time dateTime={photo.shotAt}>{photo.shotAt}</time>}
      {photo.shotAt && photo.place && ' · '}
      {photo.place}
    </span>
  );
}

function Lightbox({ photos, index, setIndex, onClose, opener }) {
  const ref = useRef(null);
  const titleId = useId();
  const photo = photos[index];
  const canMove = photos.length > 1;
  const move = step => setIndex(previous => (previous + step + photos.length) % photos.length);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = opener.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [opener]);
  function onKeyDown(event) {
    if (event.key === 'Tab') {
      const controls = ref.current.querySelectorAll('button:not(:disabled)');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (!canMove || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  }
  return (
    <dialog ref={ref} className="travel-lightbox" aria-modal="true" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
      <div className="travel-lightbox-inner">
        <header className="travel-lightbox-toolbar">
          <span aria-live="polite">{index + 1} / {photos.length}</span>
          <button type="button" aria-label="닫기" onClick={onClose}><Icon name="x" /></button>
        </header>
        <div className="travel-lightbox-photo">
          <Photo key={photo.id} photo={photo} />
          {canMove && (
            <>
              <button className="travel-lightbox-prev" type="button" aria-label="이전 사진" onClick={() => move(-1)}><Icon name="chevronLeft" /></button>
              <button className="travel-lightbox-next" type="button" aria-label="다음 사진" onClick={() => move(1)}><Icon name="chevronRight" /></button>
            </>
          )}
        </div>
        <div className="travel-lightbox-caption">
          <h3 id={titleId}>{photo.title}</h3>
          <PhotoMeta photo={photo} />
          {photo.description && <p>{photo.description}</p>}
        </div>
      </div>
    </dialog>
  );
}

function GalleryContent({ photos, coverId }) {
  const [type, setType] = useState(null);
  const [selected, setSelected] = useState(null);
  const opener = useRef(null);
  const cover = type === null ? photos.find(photo => photo.id === coverId) : null;
  const shown = type ? photos.filter(photo => photo.type === type) : photos;
  const cards = shown.filter(photo => photo.id !== cover?.id);
  const types = TYPES.filter(option => photos.some(photo => photo.type === option));
  function card(photo, featured = false) {
    const index = shown.indexOf(photo);
    return (
      <button className={`travel-photo-card${featured ? ' travel-photo-feature' : ''}`} type="button"
        aria-label={`${photo.title}, ${index + 1}번째 사진 보기`} onClick={event => {
          opener.current = event.currentTarget;
          setSelected(index);
        }}>
        <span className="travel-photo-visual"><Photo photo={photo} lazy={!featured} /></span>
        <span className="travel-photo-caption"><strong>{photo.title}</strong><PhotoMeta photo={photo} /></span>
      </button>
    );
  }
  return (
    <>
      {types.length > 0 && (
        <div className="travel-reader-chips" role="group" aria-label="사진 유형 필터">
          <button type="button" aria-pressed={type === null} onClick={() => setType(null)}>전체</button>
          {types.map(option => <button key={option} type="button" aria-pressed={type === option}
            onClick={() => setType(option)}>{option}</button>)}
        </div>
      )}
      {cover && card(cover, true)}
      {cards.length > 0 && <ul className="travel-photo-grid">{cards.map(photo => <li key={photo.id}>{card(photo)}</li>)}</ul>}
      {selected !== null && <Lightbox photos={shown} index={selected} setIndex={setSelected}
        opener={opener} onClose={() => setSelected(null)} />}
    </>
  );
}

export default function TravelGallery({ result, retry, onPinRequired }) {
  const { photos = [], coverId, configured } = result?.data ?? {};
  return (
    <section className="travel-section travel-gallery" aria-label="여행 사진">
      <header className="travel-section-heading">
        <h2>여행 사진</h2>
        {configured && <p>총 {photos.length}장</p>}
      </header>
      {!result && (
        <div role="status" aria-label="사진을 불러오는 중입니다.">
          <div className="travel-photo-grid" aria-hidden="true">
            {[0, 1, 2, 3].map(index => <span className="travel-photo-skeleton" key={index} />)}
          </div>
        </div>
      )}
      {result?.needsPin && <div className="travel-empty" role="alert">
        <p>여행 비밀번호를 다시 입력해 주세요.</p>
        <button className="travel-secondary" type="button" onClick={onPinRequired}>비밀번호 확인</button>
      </div>}
      {result?.error && <div className="travel-empty" role="alert">
        <p>사진을 불러오지 못했습니다.</p>
        <button className="travel-secondary" type="button" onClick={retry}>다시 시도</button>
      </div>}
      {configured === false && <p className="travel-empty">Notion 여행 사진 DB가 아직 연결되지 않았습니다.</p>}
      {configured && photos.length === 0 && <p className="travel-empty">
        아직 등록된 여행 사진이 없습니다. Notion의 여행 사진 DB에서 사진을 추가해 주세요.
      </p>}
      {photos.length > 0 && <GalleryContent photos={photos} coverId={coverId} />}
    </section>
  );
}
