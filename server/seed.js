/**
 * Seed the database with demo data.
 * Run: npm run seed
 * Demo logins: doctor@orthocare.test / Passw0rd!   patient@orthocare.test / Passw0rd!
 */
const { v4: uuid } = require("uuid");
const db = require("./db");
const { hashPassword } = require("./auth");

function seed() {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("doctor@orthocare.test");
  if (existing) {
    console.log("Already seeded.");
    return;
  }

  const docUserId = uuid();
  const patientId = uuid();
  const doctorId = uuid();

  const insert = db.transaction(() => {
    // Users
    db.prepare(
      `INSERT INTO users (id, role, full_name, email, phone, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(docUserId, "doctor", "Dr. Aisha Rao", "doctor@orthocare.test", "+10000000001", hashPassword("Passw0rd!"));

    db.prepare(
      `INSERT INTO users (id, role, full_name, email, phone, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(patientId, "patient", "Sam Patient", "patient@orthocare.test", "+10000000002", hashPassword("Passw0rd!"));

    // Doctor profile
    db.prepare(
      `INSERT INTO doctors (id, user_id, specialty, bio, qualifications, consult_fee, telehealth_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      doctorId, docUserId,
      "Orthopedic Surgery (Sports & Joint)",
      "20+ years in arthroscopic knee and shoulder surgery.",
      "MBBS, MS Ortho, Fellowship (Sports Medicine)",
      120, 1
    );

    // Availability rules: Mon-Fri, morning in-clinic + afternoon telehealth
    for (let wd = 0; wd < 5; wd++) {
      db.prepare(
        `INSERT INTO availability_rules (id, doctor_id, weekday, start_time, end_time, slot_minutes, mode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(uuid(), doctorId, wd, "09:00", "12:00", 30, "in_clinic");

      db.prepare(
        `INSERT INTO availability_rules (id, doctor_id, weekday, start_time, end_time, slot_minutes, mode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(uuid(), doctorId, wd, "14:00", "17:00", 30, "telehealth");
    }

    // Reasons for visit
    const reasons = [
      ["Knee Pain", 0], ["Fracture Follow-up", 0], ["Sports Injury", 0],
      ["Back/Neck Pain", 0], ["Acute Injury / Trauma", 1], ["Post-Op Review", 0],
    ];
    for (const [label, urgent] of reasons) {
      db.prepare("INSERT INTO reasons_for_visit (id, label, is_urgent_default) VALUES (?, ?, ?)").run(uuid(), label, urgent);
    }

    // Precaution content — full articles
    const content = [
      ["sports_fitness", "Dynamic Warm-Up Before Running", "knee", "video",
       "A 5-minute routine to prep knees and hips before a run.",
       `<h2>Why Warm Up?</h2>
<p>Jumping straight into a run with cold muscles is one of the top causes of knee and hip injuries among recreational runners. A dynamic warm-up increases blood flow, loosens joints, and activates the stabilizer muscles that protect your knees.</p>

<h2>The 5-Minute Routine</h2>
<p>Perform each movement for 30-40 seconds with controlled form:</p>

<h3>1. Leg Swings (Forward & Lateral)</h3>
<p>Hold a wall for balance. Swing one leg forward and back in a relaxed pendulum motion, then switch to side-to-side swings. This opens up the hip joint and stretches the hamstrings and adductors. Do 15 swings per direction per leg.</p>

<h3>2. Walking Lunges with Twist</h3>
<p>Step forward into a lunge, keeping your front knee behind your toes. At the bottom, rotate your torso toward the front leg. This activates your quads, glutes, hip flexors, and core simultaneously. Perform 8 per side.</p>

<h3>3. High Knees</h3>
<p>March in place, driving your knees to hip height. Keep your core tight and pump your arms. This raises your heart rate and primes the hip flexors. Continue for 30 seconds.</p>

<h3>4. Butt Kicks</h3>
<p>Jog in place, flicking your heels toward your glutes. This activates the hamstrings and improves knee flexion range. Continue for 30 seconds.</p>

<h3>5. Ankle Circles & Calf Raises</h3>
<p>Circle each ankle 10 times in each direction, then do 15 slow calf raises. This prepares the Achilles tendon and ankle stabilizers for the impact of running.</p>

<h2>When to Do This</h2>
<p>Perform this routine immediately before every run — even easy recovery runs. It takes only 5 minutes but can prevent weeks of downtime from a preventable injury.</p>

<h2>Warning Signs</h2>
<p>If any movement causes sharp pain (not just stiffness), stop and consult your doctor. Persistent knee pain during warm-up may indicate an underlying issue that needs attention before you continue training.</p>`],

      ["sports_fitness", "Safe Barbell Squat Form", "back", "gif",
       "Bracing and depth cues to protect your lower back.",
       `<h2>The Squat: King of Exercises — If Done Right</h2>
<p>The barbell back squat is one of the most effective exercises for building lower body strength, but poor form is a leading cause of lower back injuries in the gym. Here's how to squat safely.</p>

<h2>Setting Up</h2>
<p><strong>Bar position:</strong> Place the bar across your upper traps (high bar) or rear delts (low bar). Never rest it on your neck bones. Grip the bar slightly wider than shoulder-width and squeeze your shoulder blades together to create a muscular shelf.</p>
<p><strong>Foot stance:</strong> Feet shoulder-width apart, toes pointed out 15-30 degrees. Your knees should track over your toes throughout the movement.</p>

<h2>The Brace</h2>
<p>Before every rep, take a deep belly breath and brace your core as if someone is about to punch you in the stomach. This intra-abdominal pressure creates a natural weightlifting belt that protects your spine. Hold this brace throughout the entire rep.</p>

<h2>The Descent</h2>
<p>Initiate the squat by pushing your hips back and bending your knees simultaneously. Keep your chest up and your back in a neutral position — no rounding. Descend until your hip crease drops just below your knee (parallel or slightly below).</p>

<h2>Common Mistakes</h2>
<ul>
<li><strong>Butt wink:</strong> If your lower back rounds at the bottom, you're going too deep for your current mobility. Work on hip and ankle flexibility.</li>
<li><strong>Knee cave:</strong> Knees collapsing inward puts stress on the MCL. Push your knees out over your toes.</li>
<li><strong>Forward lean:</strong> Excessive forward torso lean loads the lower back. Focus on keeping the bar over mid-foot.</li>
<li><strong>Bouncing:</strong> Never bounce out of the bottom position. Control the descent and reverse smoothly.</li>
</ul>

<h2>Recommended Progression</h2>
<p>Start with bodyweight squats, then progress to goblet squats, and only add the barbell when you can perform 3 sets of 15 goblet squats with perfect form. Increase barbell weight by no more than 2.5-5 kg per week.</p>`],

      ["ergonomics", "Desk Posture Reset", "back", "article",
       "Monitor height, chair, and micro-break guidance for pain-free office work.",
       `<h2>Why Desk Posture Matters</h2>
<p>The average office worker sits for 8-10 hours per day. Poor posture during this time is a primary driver of chronic back pain, neck stiffness, and shoulder tension. The good news: small adjustments can make a big difference.</p>

<h2>The Ideal Setup</h2>

<h3>Monitor Position</h3>
<p>The top of your screen should be at or slightly below eye level, about an arm's length away (50-70 cm). This prevents you from tilting your head up or down, which strains the neck. If you use a laptop, invest in a laptop stand and an external keyboard.</p>

<h3>Chair Adjustment</h3>
<p>Your feet should be flat on the floor with knees bent at roughly 90 degrees. The chair backrest should support your lumbar curve — if it doesn't, use a small rolled-up towel or lumbar pillow. Armrests should allow your shoulders to relax, not hunch.</p>

<h3>Keyboard & Mouse</h3>
<p>Elbows should be bent at 90-100 degrees with forearms parallel to the floor. Keep your wrists in a neutral (straight) position — not bent up or down. The mouse should be right next to the keyboard so you don't have to reach.</p>

<h2>The 20-20-20 Rule</h2>
<p>Every 20 minutes, look at something 20 feet away for 20 seconds. This reduces eye strain and gives you a natural cue to check your posture.</p>

<h2>Micro-Break Routine (Every 45 Minutes)</h2>
<p>Stand up and do these for 60 seconds total:</p>
<ul>
<li><strong>Chin tucks:</strong> Pull your chin straight back (making a double chin) and hold 5 seconds. Repeat 5 times. Relieves neck tension.</li>
<li><strong>Shoulder rolls:</strong> Roll shoulders backward 10 times. Opens the chest and counteracts the forward-hunch position.</li>
<li><strong>Standing back extension:</strong> Place hands on lower back and gently arch backward. Hold 5 seconds, repeat 3 times.</li>
</ul>

<h2>When to Seek Help</h2>
<p>If you have persistent back or neck pain that doesn't improve with posture correction after 2 weeks, schedule a consultation. Chronic pain may indicate a disc or joint issue that benefits from professional treatment.</p>`],

      ["ergonomics", "Wrist Care for Typists", "wrist", "article",
       "Neutral wrist positioning and stretches to prevent carpal tunnel.",
       `<h2>Typing and Your Wrists</h2>
<p>Repetitive strain injuries (RSI) like carpal tunnel syndrome and tendinitis are increasingly common among people who type for hours daily. The key to prevention is keeping your wrists in a neutral position and taking regular stretch breaks.</p>

<h2>Neutral Wrist Position</h2>
<p>Your wrists should be straight — not angled up, down, or to the side — when typing. The back of your hand should form a straight line with your forearm. If your keyboard forces your wrists upward, consider a negative-tilt keyboard tray or a split ergonomic keyboard.</p>

<h2>What to Avoid</h2>
<ul>
<li><strong>Wrist rests while typing:</strong> These are for resting between typing bursts, not during active typing. Pressing your wrist into a rest while typing compresses the carpal tunnel.</li>
<li><strong>Death grip on the mouse:</strong> Hold your mouse lightly. A tight grip fatigues the forearm muscles and increases tendon strain.</li>
<li><strong>Hovering wrists:</strong> If you hold your wrists elevated above the keyboard for long periods, the forearm muscles fatigue. Let them rest between sentences.</li>
</ul>

<h2>5-Minute Wrist Stretch Routine</h2>
<p>Do this every 1-2 hours:</p>

<h3>1. Prayer Stretch</h3>
<p>Press palms together in front of your chest, fingers pointing up. Slowly lower your hands toward your waist while keeping palms together until you feel a stretch. Hold 15 seconds.</p>

<h3>2. Wrist Flexor Stretch</h3>
<p>Extend one arm forward, palm up. Use the other hand to gently pull your fingers downward. Hold 15 seconds per hand.</p>

<h3>3. Wrist Extensor Stretch</h3>
<p>Extend one arm forward, palm down. Use the other hand to gently press your fingers toward you. Hold 15 seconds per hand.</p>

<h3>4. Finger Spreads</h3>
<p>Spread all fingers wide, hold 5 seconds, then make a tight fist. Repeat 10 times. This improves blood flow to the tendons.</p>

<h3>5. Wrist Circles</h3>
<p>Circle each wrist slowly 10 times clockwise, then 10 times counterclockwise.</p>

<h2>When to See a Doctor</h2>
<p>Tingling, numbness, or weakness in your fingers — especially the thumb, index, and middle fingers — may indicate carpal tunnel syndrome. Early treatment is much more effective than waiting.</p>`],

      ["age_specific", "Fall Prevention for Seniors", "knee", "article",
       "Home hazard checklist and balance exercises for older adults.",
       `<h2>Falls Are the #1 Injury Risk for Adults 65+</h2>
<p>One in four older adults falls each year, and falls are the leading cause of fractures, head injuries, and loss of independence. The good news: most falls are preventable with simple home modifications and regular balance training.</p>

<h2>Home Safety Checklist</h2>
<p>Walk through every room and check for these hazards:</p>

<h3>Floors & Walkways</h3>
<ul>
<li>Remove loose rugs or secure them with non-slip backing</li>
<li>Keep electrical cords out of walking paths</li>
<li>Clean up spills immediately</li>
<li>Ensure all hallways and stairways are well-lit</li>
</ul>

<h3>Bathroom (Highest Risk Area)</h3>
<ul>
<li>Install grab bars next to the toilet and inside the shower/tub</li>
<li>Use a non-slip bath mat inside the tub</li>
<li>Consider a shower chair if balance is a concern</li>
<li>Use a raised toilet seat if getting up from the toilet is difficult</li>
</ul>

<h3>Stairs</h3>
<ul>
<li>Install handrails on both sides</li>
<li>Mark the edges of steps with contrasting tape</li>
<li>Keep stairs clutter-free</li>
<li>Ensure good lighting at top and bottom</li>
</ul>

<h2>Daily Balance Exercises</h2>
<p>Do these near a counter or sturdy chair for support:</p>

<h3>1. Heel-to-Toe Walk</h3>
<p>Walk in a straight line placing the heel of one foot directly in front of the toes of the other. Take 20 steps. This improves your balance and coordination.</p>

<h3>2. Single-Leg Stands</h3>
<p>Stand on one foot for 10-30 seconds, then switch. Do 3 rounds per leg. Use a chair for support at first, then try without.</p>

<h3>3. Sit-to-Stand</h3>
<p>From a sturdy chair, stand up without using your hands, then sit back down slowly. Do 10 repetitions. This builds the leg strength needed to recover from a stumble.</p>

<h3>4. Side Leg Raises</h3>
<p>Hold a chair and lift one leg out to the side, hold 3 seconds, lower slowly. Do 10 per side. Strengthens the hip abductors that keep you stable.</p>

<h2>Additional Tips</h2>
<ul>
<li>Have your vision checked annually — poor vision increases fall risk</li>
<li>Review medications with your doctor — some cause dizziness</li>
<li>Wear supportive, non-slip shoes even indoors</li>
<li>Stay physically active — even gentle walking helps maintain balance</li>
</ul>`],

      ["age_specific", "Bone Density Optimization", "back", "article",
       "Nutrition and weight-bearing exercise to keep bones strong.",
       `<h2>Why Bone Density Matters</h2>
<p>Bone density peaks around age 30 and gradually declines after that. Low bone density (osteopenia) can progress to osteoporosis, making bones fragile and fracture-prone. A fall that would cause a bruise in a young person can cause a hip or spine fracture in someone with osteoporosis.</p>

<h2>Nutrition for Strong Bones</h2>

<h3>Calcium</h3>
<p>Adults need 1,000-1,200 mg of calcium daily. Good sources include dairy products, leafy greens (kale, broccoli), sardines, almonds, and fortified foods. If you can't get enough from diet, talk to your doctor about supplements.</p>

<h3>Vitamin D</h3>
<p>Vitamin D is essential for calcium absorption. Aim for 600-800 IU daily (some experts recommend more). Sources include sunlight exposure (15-20 minutes of midday sun), fatty fish, egg yolks, and supplements. Many people are deficient — ask your doctor to check your levels.</p>

<h3>Protein</h3>
<p>Bone is about 50% protein by volume. Aim for 1.0-1.2 g of protein per kg of body weight daily. Include lean meats, fish, beans, eggs, and dairy in your diet.</p>

<h3>What to Limit</h3>
<ul>
<li><strong>Excess sodium:</strong> High salt intake increases calcium excretion through urine</li>
<li><strong>Excess caffeine:</strong> More than 3 cups of coffee per day may reduce calcium absorption</li>
<li><strong>Alcohol:</strong> Heavy drinking interferes with bone formation</li>
<li><strong>Smoking:</strong> Directly toxic to bone-forming cells</li>
</ul>

<h2>Weight-Bearing Exercise</h2>
<p>Bones get stronger when you put load through them. The best exercises for bone density are:</p>

<h3>High Impact (if joints allow)</h3>
<ul>
<li>Walking and hiking</li>
<li>Jogging</li>
<li>Stair climbing</li>
<li>Dancing</li>
<li>Tennis or pickleball</li>
</ul>

<h3>Resistance Training</h3>
<ul>
<li>Squats and lunges (bodyweight or weighted)</li>
<li>Deadlifts (start light, focus on form)</li>
<li>Overhead press</li>
<li>Resistance bands</li>
</ul>
<p>Aim for weight-bearing or resistance exercise at least 3-4 times per week, 30 minutes per session.</p>

<h2>When to Get Tested</h2>
<p>A DEXA scan measures bone density and takes about 10 minutes. Recommended for all women over 65, men over 70, and anyone with risk factors (family history, early menopause, long-term steroid use, previous fracture).</p>`],

      ["post_op", "ACL: What to Avoid in Week 1", "knee", "article",
       "Critical dos and don'ts for the first week after ACL reconstruction.",
       `<h2>The First Week Is Critical</h2>
<p>ACL reconstruction surgery replaces your torn anterior cruciate ligament with a graft. The first week post-op is when the graft is most vulnerable and your knee is most swollen. What you do — and don't do — during this period sets the stage for your entire recovery.</p>

<h2>What to AVOID</h2>

<h3>1. Bearing Full Weight Without Support</h3>
<p>Use your crutches for ALL walking, even short trips to the bathroom. Your surgeon will tell you how much weight you can put through the leg. Putting too much weight too soon can damage the graft before it has started to heal into the bone tunnels.</p>

<h3>2. Skipping the Ice and Elevation</h3>
<p>Ice your knee for 20 minutes every 2 hours while awake. Keep your leg elevated above heart level as much as possible. This controls swelling, which is the #1 barrier to regaining range of motion. Uncontrolled swelling can lead to stiffness that takes months to resolve.</p>

<h3>3. Removing Your Brace Without Permission</h3>
<p>If your surgeon placed you in a knee brace, wear it as directed — usually at all times including sleep for the first 1-2 weeks. The brace protects the graft from unexpected twisting or hyperextension.</p>

<h3>4. Pushing Through Pain for Range of Motion</h3>
<p>Gentle range of motion exercises (like heel slides) are important, but forcing your knee to bend should never cause sharp pain. Work within a comfortable range and let it improve gradually day by day.</p>

<h3>5. Sitting with Your Knee Bent for Long Periods</h3>
<p>Prolonged sitting with the knee bent (e.g., at a desk or in a recliner) can cause the knee to stiffen in a flexed position. Aim to straighten (extend) the knee fully several times per day — extension is actually harder to regain than flexion.</p>

<h3>6. Driving</h3>
<p>Do not drive for at least 2 weeks (right knee) or until you are off pain medication. You cannot react quickly enough with a post-surgical knee to brake safely.</p>

<h2>What to DO in Week 1</h2>
<ul>
<li><strong>Ankle pumps:</strong> 3 sets of 15, every 2 hours. Prevents blood clots.</li>
<li><strong>Quad sets:</strong> Tighten your thigh muscle and hold 5 seconds, 3 sets of 10. Prevents muscle atrophy.</li>
<li><strong>Gentle heel slides:</strong> Slide your heel toward your buttock as far as comfortable, then straighten. 2 sets of 10.</li>
<li><strong>Take pain medication on schedule</strong> — don't wait until pain is severe.</li>
<li><strong>Watch for warning signs:</strong> Calf pain/swelling (blood clot), fever over 101°F, excessive drainage from incisions, or increasing redness. Call your surgeon immediately if any occur.</li>
</ul>

<h2>The Big Picture</h2>
<p>Full ACL recovery takes 9-12 months. Week 1 is just the start, but getting it right makes everything that follows easier. Follow your surgeon's protocol, attend all physical therapy sessions, and be patient with the process.</p>`],
    ];
    for (const [cat, title, region, mtype, summary, body] of content) {
      db.prepare(
        `INSERT INTO precaution_content (id, category, title, body_region, media_type, summary, body, media_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(uuid(), cat, title, region, mtype, summary, body, "https://media.orthocare.example/demo");
    }

    // Recovery plan
    const planId = uuid();
    db.prepare(
      "INSERT INTO recovery_plans (id, name, description, duration_days) VALUES (?, ?, ?, ?)"
    ).run(planId, "ACL Reconstruction Recovery", "6-week guided post-op track.", 42);

    const tasks = [
      [1, "avoid", "Avoid bearing full weight without crutches."],
      [1, "exercise", "Ankle pumps: 3 sets of 15."],
      [2, "exercise", "Quad sets: 3 sets of 10, hold 5s."],
      [3, "checkin", "Rate pain & swelling 0-10."],
      [7, "exercise", "Heel slides: 2 sets of 10."],
      [14, "exercise", "Stationary bike, light resistance, 10 min."],
    ];
    for (const [day, kind, instr] of tasks) {
      db.prepare(
        "INSERT INTO recovery_tasks (id, plan_id, day_number, kind, instruction) VALUES (?, ?, ?, ?, ?)"
      ).run(uuid(), planId, day, kind, instr);
    }
  });

  insert();
  console.log("Seeded: doctor, patient, availability, reasons, content, recovery plan.");
  console.log("Demo logins:");
  console.log("  doctor@orthocare.test  / Passw0rd!");
  console.log("  patient@orthocare.test / Passw0rd!");
}

seed();
