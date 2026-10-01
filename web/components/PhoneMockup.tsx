import { Bell } from "lucide-react";
import { Art } from "./Art";

export function PhoneMockup() {
  return (
    <div className="phone-stage" aria-hidden>
      <div className="phone">
        <div className="phone__notch" />
        <div className="phone__screen">
          <div className="phone__top">
            <Art src="/brand/logo-blue.png" darkSrc="/brand/logo-white.png" alt="" />
            <Bell />
          </div>
          <div className="phone__status">
            <small>Your order is</small>
            <strong>On the way</strong>
            <small>Arriving in about 12 min</small>
          </div>
          <div className="phone__map" />
          <div className="phone__sheet">
            <ul className="timeline">
              <li className="done">Rider assigned <time>10:24</time></li>
              <li className="done">Picked up <time>10:31</time></li>
              <li className="done">On the way <time>10:36</time></li>
              <li>Delivered</li>
            </ul>
          </div>
          <div className="phone__otp">
            Delivery code <b>4 7 2 9</b>
          </div>
        </div>
      </div>
    </div>
  );
}
