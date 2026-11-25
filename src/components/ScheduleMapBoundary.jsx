import { Component } from 'react';

export default class ScheduleMapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="travel-empty" role="alert">
      <p>지도 모듈을 불러오지 못했습니다. 타임라인에서 일정을 확인해 주세요.</p>
      <button type="button" onClick={this.props.onTimeline}>타임라인 보기</button>
    </div> : this.props.children;
  }
}
