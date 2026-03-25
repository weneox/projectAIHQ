import { motion, useReducedMotion } from "framer-motion";

export default function LoginBackgroundScene() {
  const reduceMotion = useReducedMotion();

  const drift = (
    duration,
    delay = 0,
    x = 10,
    y = 8,
    opacityA = 0.9,
    opacityB = 1
  ) =>
    reduceMotion
      ? {}
      : {
          animate: {
            x: [0, x, -x * 0.8, 0],
            y: [0, -y, y * 0.7, 0],
            opacity: [opacityA, opacityB, opacityA],
          },
          transition: {
            duration,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          },
        };

  const curtain = ({
    duration,
    rotateA,
    rotateB,
    xA,
    xB,
    yA,
    yB,
    opacityA,
    opacityB,
    scaleXA = 1,
    scaleXB = 1.03,
  }) =>
    reduceMotion
      ? {}
      : {
          animate: {
            rotate: [rotateA, rotateB, rotateA],
            x: [0, xA, xB, 0],
            y: [0, yA, yB, 0],
            opacity: [opacityA, opacityB, opacityA],
            scaleX: [scaleXA, scaleXB, scaleXA],
          },
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut",
          },
        };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.98),rgba(247,244,239,0.98)_40%,rgba(242,236,230,1)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)]" />

      <div className="absolute left-1/2 top-1/2 h-[86vh] w-[74vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/52 blur-[96px]" />

      <motion.div
        className="absolute left-[-14%] top-[22%] h-[22vh] w-[84vw] rounded-[999px] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.68),rgba(255,255,255,0))] blur-[1px]"
        initial={{ rotate: -20, opacity: 0.78 }}
        {...curtain({
          duration: 24,
          rotateA: -20,
          rotateB: -17.8,
          xA: 18,
          xB: -10,
          yA: -6,
          yB: 5,
          opacityA: 0.76,
          opacityB: 0.96,
          scaleXA: 1,
          scaleXB: 1.04,
        })}
      />

      <motion.div
        className="absolute left-[2%] top-[42%] h-[28vh] w-[68vw] rounded-[999px] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(224,241,246,0.56),rgba(255,255,255,0))]"
        initial={{ rotate: -30, opacity: 0.64 }}
        {...curtain({
          duration: 22,
          rotateA: -30,
          rotateB: -27.5,
          xA: -14,
          xB: 10,
          yA: 8,
          yB: -6,
          opacityA: 0.6,
          opacityB: 0.84,
          scaleXA: 1,
          scaleXB: 1.035,
        })}
      />

      <motion.div
        className="absolute left-[16%] top-[64%] h-[16vh] w-[48vw] rounded-[999px] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.44),rgba(255,255,255,0))]"
        initial={{ rotate: -31, opacity: 0.5 }}
        {...curtain({
          duration: 18,
          rotateA: -31,
          rotateB: -29.2,
          xA: 10,
          xB: -6,
          yA: -4,
          yB: 4,
          opacityA: 0.48,
          opacityB: 0.72,
          scaleXA: 1,
          scaleXB: 1.03,
        })}
      />

      <motion.div
        className="absolute left-[14%] top-[36%] h-[34vh] w-[16vw] rounded-full bg-cyan-100/18 blur-[58px]"
        initial={{ opacity: 0.46 }}
        {...drift(20, 0.2, 10, 10, 0.42, 0.58)}
      />

      <motion.div
        className="absolute right-[-16%] top-[-10%] h-[142vh] w-[43vw] rounded-[999px] bg-[linear-gradient(180deg,rgba(255,228,180,0.98),rgba(255,190,125,0.92)_24%,rgba(248,166,118,0.75)_48%,rgba(238,198,255,0.22)_72%,rgba(255,255,255,0)_100%)]"
        initial={{ rotate: 27, opacity: 0.9 }}
        {...curtain({
          duration: 26,
          rotateA: 27,
          rotateB: 25.3,
          xA: -18,
          xB: 10,
          yA: 11,
          yB: -8,
          opacityA: 0.88,
          opacityB: 0.98,
          scaleXA: 1,
          scaleXB: 1.05,
        })}
      />

      <motion.div
        className="absolute right-[-2%] top-[-10%] h-[132vh] w-[16vw] rounded-[999px] bg-[linear-gradient(180deg,rgba(255,248,225,1),rgba(255,227,150,0.96)_28%,rgba(255,173,100,0.52)_60%,rgba(255,255,255,0)_100%)]"
        initial={{ rotate: 27, opacity: 0.96 }}
        {...curtain({
          duration: 20,
          rotateA: 27,
          rotateB: 26.1,
          xA: 9,
          xB: -6,
          yA: -7,
          yB: 5,
          opacityA: 0.94,
          opacityB: 1,
          scaleXA: 1,
          scaleXB: 1.03,
        })}
      />

      <motion.div
        className="absolute right-[7%] top-[-8%] h-[126vh] w-[6vw] rounded-[999px] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,241,210,0.96)_36%,rgba(255,198,132,0.36)_70%,rgba(255,255,255,0)_100%)]"
        initial={{ rotate: 27, opacity: 0.98 }}
        {...curtain({
          duration: 16,
          rotateA: 27,
          rotateB: 26.45,
          xA: -5,
          xB: 4,
          yA: 5,
          yB: -4,
          opacityA: 0.96,
          opacityB: 1,
          scaleXA: 1,
          scaleXB: 1.02,
        })}
      />

      <motion.div
        className="absolute right-[11.5%] top-[3%] h-[102vh] w-[2px] rounded-full bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.97),transparent)]"
        initial={{ rotate: 27, opacity: 0.76 }}
        {...curtain({
          duration: 14,
          rotateA: 27,
          rotateB: 26.6,
          xA: 2,
          xB: -2,
          yA: 3,
          yB: -3,
          opacityA: 0.74,
          opacityB: 0.96,
          scaleXA: 1,
          scaleXB: 1.01,
        })}
      />

      <div className="absolute right-[-4%] top-[10%] h-[88vh] w-[20vw] rotate-[27deg] rounded-[999px] bg-[linear-gradient(180deg,rgba(255,239,223,0.2),rgba(255,255,255,0.02))] blur-[28px]" />

      <div className="absolute inset-y-0 left-[10.6%] hidden w-px bg-[linear-gradient(180deg,transparent,rgba(148,163,184,0.09),transparent)] xl:block" />
      <div className="absolute inset-y-0 right-[10.2%] hidden w-px bg-[linear-gradient(180deg,transparent,rgba(148,163,184,0.08),transparent)] xl:block" />

      <div className="absolute bottom-0 left-0 right-0 h-[24vh] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.42))]" />

      <motion.div
        className="absolute bottom-[7%] left-[14%] h-7 w-[38vw] rounded-full bg-white/40 blur-[12px]"
        initial={{ opacity: 0.34 }}
        {...drift(16, 0.15, 12, 4, 0.32, 0.46)}
      />
      <motion.div
        className="absolute bottom-[9.5%] left-[18%] h-5 w-[30vw] rounded-full bg-white/34 blur-[10px]"
        initial={{ opacity: 0.26 }}
        {...drift(14, 0.28, 8, 3, 0.24, 0.38)}
      />
      <div className="absolute bottom-[11%] left-[14%] h-px w-[38vw] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.82),transparent)]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(15,23,42,0.032)_100%)]" />
    </div>
  );
}