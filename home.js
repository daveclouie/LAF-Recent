import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy // 👈 Add this
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { firebaseConfig } from './firebase.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const lostForm = document.getElementById("lostForm");
const foundForm = document.getElementById("foundForm");
const lostItems = document.getElementById("lostItems");
const foundItems = document.getElementById("foundItems");
const profileContent = document.getElementById("profileContent");

let currentPopupItem = null;

let notificationsLoaded = false;




document.addEventListener("DOMContentLoaded", () => {
  let savedTab = localStorage.getItem('activeTab') || 'home';

  // If we reload on the signout tab, switch to home
  if (savedTab === 'signout') {
    savedTab = 'home';
    localStorage.setItem('activeTab', 'home');
  }

  const tabButton = Array.from(document.querySelectorAll('.tab-button'))
    .find(btn => btn.textContent.toLowerCase().replace(/\s+/g, "") === savedTab);

  // Show the saved tab right away
  showTab(savedTab, tabButton);

  // Make everything visible now
  document.body.classList.add('tabs-ready');
});


function showTab(tabId, button) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));
  if (button) button.classList.add('active-tab');

  // Save current tab to localStorage
  localStorage.setItem('activeTab', tabId);

    // Reset forms when switching away from them
  if (tabId !== 'reportlost') {
    const lostForm = document.getElementById("lostForm");
    if (lostForm) lostForm.reset();
  }

  if (tabId !== 'reportfound') {
    const foundForm = document.getElementById("foundForm");
    if (foundForm) foundForm.reset();
  }

}

document.querySelectorAll(".tab-button").forEach(button => {
  // ✅ Skip the notification bell
  if (button.id === "notificationBtn") return;

  button.addEventListener("click", () => {
    const tabId = button.textContent.toLowerCase().replace(/\s+/g, "");
    showTab(tabId, button);
  });
});


document.addEventListener("click", function (e) {
  if (e.target && e.target.classList.contains("cancel-btn")) {
    console.log("✅ Cancel button clicked");

    const form = e.target.closest("form");
    if (form) form.reset();

    const homeTabButton = Array.from(document.querySelectorAll(".tab-button"))
      .find(btn => btn.textContent.trim().toLowerCase() === "home");

    if (homeTabButton) {
      showTab("home", homeTabButton);
    }
  }
});


async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "lost-and-found");

  const response = await fetch("https://api.cloudinary.com/v1_1/dbcgpoclo/image/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  return data.secure_url;
}

if (lostForm) {
  lostForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = lostForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const user = auth.currentUser;
    if (!user) {
      showToast("You must be signed in to report.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      return;
    }

    try {
      const imageFile = document.getElementById("lostImage").files[0];
      const imageUrl = imageFile ? await uploadImageToCloudinary(imageFile) : "";

      const docData = {
        title: document.getElementById("lostTitle").value,
        location: document.getElementById("lostLocation").value,
        description: document.getElementById("lostDescription").value,
        contact: document.getElementById("lostContact").value,
        date: document.getElementById("lostDate").value,
        imageUrl,
        type: "lost",
        uid: user.uid,
        timestamp: Date.now(),
      };

      await addDoc(collection(db, "items"), docData);
e.target.reset();

// ✅ Reload page and show profile tab with new item
localStorage.setItem("activeTab", "profile");
window.location.reload();


// 🔁 If user is on profile, refresh it
if (localStorage.getItem("activeTab") === "profile" && auth.currentUser) {
  loadUserItems(auth.currentUser.uid);
}

    } catch (err) {
      showToast("Error submitting item. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });
}

if (foundForm) {
  foundForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = foundForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const user = auth.currentUser;
    if (!user) {
      showToast("You must be signed in to report.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      return;
    }

    try {
      const imageFile = document.getElementById("foundImage").files[0];
      const imageUrl = imageFile ? await uploadImageToCloudinary(imageFile) : "";

      const docData = {
        title: document.getElementById("foundTitle").value,
        location: document.getElementById("foundLocation").value,
        description: document.getElementById("foundDescription").value,
        contact: document.getElementById("foundContact").value,
        date: document.getElementById("foundDate").value,
        imageUrl,
        type: "found",
        uid: user.uid,
        timestamp: Date.now(),
      };

      await addDoc(collection(db, "items"), docData);
e.target.reset();

// ✅ Reload page and show profile tab with new item
localStorage.setItem("activeTab", "profile");
window.location.reload();


if (localStorage.getItem("activeTab") === "profile" && auth.currentUser) {
  loadUserItems(auth.currentUser.uid);
}


    } catch (err) {
      showToast("Error submitting item. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });
}

onSnapshot(collection(db, "items"), (snapshot) => {
  lostItems.innerHTML = "";
  foundItems.innerHTML = "";

  snapshot.forEach((doc) => {
    const item = doc.data();
    item.id = doc.id; // ✅ Add the document ID to the item
    const div = document.createElement("div");
    div.className = "item-box" + (item.type === "found" ? " found" : "");
    div.innerHTML = `
  <h3>${item.title}</h3>
  ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="width:100%; max-height:150px; object-fit:cover; border-radius:6px;" />` : ""}
  <p style="font-size: 0.85em; color: #777;">Click for details</p>
`;

div.addEventListener("click", () => {
  showItemPopup(item);
});

    if (item.type === "lost") {
      lostItems.appendChild(div);
    } else {
      foundItems.appendChild(div);
    }
  });
});

async function loadUserItems(uid) {
  const q = query(collection(db, "items"), where("uid", "==", uid));
  const querySnapshot = await getDocs(q);

  const userItemsHTML = querySnapshot.docs.map(doc => {
    const item = doc.data();
    const itemId = doc.id;
    return `
      <div class="item-box${item.type === 'found' ? ' found' : ''}" style="padding:10px; margin:10px 0;">
        <h4 style="font-size: 14px;">${item.title} (${item.location})</h4>
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="width:100%; max-width:150px; border-radius:8px;" />` : ""}
        <p style="font-size:12px;">${item.description}</p>
        <p style="font-size:12px;"><strong>Contact:</strong> ${item.contact}</p>
        <p style="font-size:12px;"><strong>Date:</strong> ${item.date}</p>
        <button class="edit-btn" data-id="${itemId}" data-type="${item.type}">Edit</button>
        <button class="delete-btn" data-id="${itemId}">Delete</button>
      </div>
    `;
  }).join('');

  const wrapper = `
    <div style="margin-top:20px;">
      <h3 style="font-size:16px;">Your Posted Items</h3>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:10px;">
        ${userItemsHTML}
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = wrapper;

  const existingItems = document.querySelector('#profileContent .item-box')?.parentNode?.parentNode;
  if (existingItems) existingItems.remove();
  profileContent.appendChild(container);

  attachItemButtons(uid);
}

function attachItemButtons(uid) {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Are you sure you want to delete this item?')) {
        await deleteDoc(doc(db, "items", id));
        showToast("Item deleted.");
        loadUserItems(uid);
      }
    });
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      const docSnap = await getDoc(doc(db, "items", id));
      const item = docSnap.data();

      showTab(type === 'lost' ? 'reportlost' : 'reportfound', document.querySelector(`.tab-button[onclick*="${type}"]`));

      document.getElementById(`${type}Title`).value = item.title;
      document.getElementById(`${type}Location`).value = item.location;
      document.getElementById(`${type}Description`).value = item.description;
      document.getElementById(`${type}Contact`).value = item.contact;
      document.getElementById(`${type}Date`).value = item.date;

      const form = document.getElementById(`${type}Form`);





      newForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedData = {
          title: document.getElementById(`${type}Title`).value,
          location: document.getElementById(`${type}Location`).value,
          description: document.getElementById(`${type}Description`).value,
          contact: document.getElementById(`${type}Contact`).value,
          date: document.getElementById(`${type}Date`).value,
        };

        const imageFile = document.getElementById(`${type}Image`).files[0];
        if (imageFile) {
          updatedData.imageUrl = await uploadImageToCloudinary(imageFile);
        }

        await setDoc(doc(db, "items", id), { ...item, ...updatedData });
        showToast("Item updated.");
        newForm.reset();
        showTab("profile", document.querySelector(".tab-button[onclick*='profile']"));
        loadUserItems(uid);
      });
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "Anonymous",
        contact: "Not set",
        location: "Not set",
        photoURL: user.photoURL || "",
        createdAt: Date.now()
      });
    }

    const userData = (await getDoc(userRef)).data();


    profileContent.innerHTML = `
      <form id="profileForm" class="report-form">
        ${userData.photoURL ? `<img src="${userData.photoURL}" alt="Profile Picture" id="previewImage" style="width:100px; height:100px; border-radius:50%; margin-bottom:10px;">` : ""}
        <label for="newPhoto">Profile Picture</label>
        <input type="file" id="newPhoto" accept="image/*" />

        <label for="profileName">Name</label>
        <input type="text" id="profileName" value="${userData.displayName || ''}" required />

        <label for="profileEmail">Email</label>
        <input type="email" id="profileEmail" value="${userData.email}" readonly />

        <label for="profileContact">Contact</label>
        <input type="text" id="profileContact" value="${userData.contact || ''}" />

        <label for="profileLocation">Location</label>
        <input type="text" id="profileLocation" value="${userData.location || ''}" />

        <button type="submit">Save Changes</button>
      </form>
    `;

    document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const saveBtn = document.querySelector("#profileForm button[type='submit']");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving changes...";

  const name = document.getElementById("profileName").value;
  const contact = document.getElementById("profileContact").value;
  const location = document.getElementById("profileLocation").value;
  const newPhotoFile = document.getElementById("newPhoto").files[0];

  let photoURL = userData.photoURL || "";
  if (newPhotoFile) {
    try {
      photoURL = await uploadImageToCloudinary(newPhotoFile);
    } catch (err) {
      showToast("Image upload failed. Please try again.");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
      return;
    }
  }

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: name,
    contact,
    location,
    photoURL,
    createdAt: userData.createdAt || Date.now()
  });

  showToast("Profile updated successfully!");

  // Update the preview image if needed
  if (newPhotoFile && photoURL) {
    const previewImage = document.getElementById("previewImage");
    if (previewImage) {
      previewImage.src = photoURL;
    } else {
      const img = document.createElement("img");
      img.id = "previewImage";
      img.src = photoURL;
      img.alt = "Profile Picture";
      img.style.width = "100px";
      img.style.height = "100px";
      img.style.borderRadius = "50%";
      img.style.marginBottom = "10px";
      document.getElementById("profileForm").insertBefore(img, document.getElementById("newPhoto"));
    }
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Save Changes";
}, { once: true });


    await loadUserItems(user.uid);
    listenToNotifications(user.uid);
  } else {
    profileContent.innerHTML = `<p>Please log in to view your profile.</p>`;
  }
});

const modal = document.getElementById("signOutModal");
const confirmBtn = document.getElementById("confirmLogout");
const cancelBtn = document.getElementById("cancelLogout");

document.querySelector('button[onclick*="signout"]').addEventListener("click", (e) => {
  e.preventDefault();
  modal.style.display = "flex";
});

confirmBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
  localStorage.setItem("activeTab", "home"); // Ensure future reloads go home
  showTab("home", document.querySelector(".tab-button:first-child"));
});


window.addEventListener('DOMContentLoaded', () => {
  const savedTab = localStorage.getItem('activeTab') || 'home';

  const tabButton = Array.from(document.querySelectorAll('.tab-button'))
    .find(btn => btn.textContent.toLowerCase().replace(/\s+/g, "") === savedTab);

  showTab(savedTab, tabButton);
});

// ✅ Global Cancel Button Handler (for both Report Lost and Found)
document.addEventListener("click", function (e) {
  if (e.target && e.target.classList.contains("cancel-btn")) {
    const form = e.target.closest("form");
    if (form) form.reset();

    const homeTabButton = Array.from(document.querySelectorAll(".tab-button"))
      .find(btn => btn.textContent.trim().toLowerCase() === "home");

    if (homeTabButton) {
      showTab("home", homeTabButton);
    }
  }
});

function showItemPopup(item) {
  currentPopupItem = item;

  document.getElementById("popupTitle").textContent = item.title;
  document.getElementById("popupImage").src = item.imageUrl || "";
  document.getElementById("popupImage").style.display = item.imageUrl ? "block" : "none";
  document.getElementById("popupDescription").textContent = item.description;
  document.getElementById("popupLocation").textContent = item.location;
  document.getElementById("popupContact").textContent = item.contact;
  document.getElementById("popupDate").textContent = item.date;

  const checkItemBtn = document.getElementById("checkItemBtn");
  const user = auth.currentUser;

  if (user && user.uid === item.uid) {
    checkItemBtn.style.display = "none"; // Hide button if it's the user's own item
  } else {
    checkItemBtn.style.display = "inline-block"; // Show button otherwise
    checkItemBtn.disabled = false;
  }

  document.getElementById("itemPopup").style.display = "flex";
}


document.getElementById("closePopup").addEventListener("click", () => {
  document.getElementById("itemPopup").style.display = "none";
});

document.getElementById("checkItemBtn").addEventListener("click", async () => {
  const checkItemBtn = document.getElementById("checkItemBtn");
  checkItemBtn.disabled = true;

  const user = auth.currentUser;
  if (!user) {
    showToast("Please sign in to check this item.");
    checkItemBtn.disabled = false;
    return;
  }

  if (!currentPopupItem || !currentPopupItem.uid || !currentPopupItem.id) {
    showToast("Item data is missing.");
    checkItemBtn.disabled = false;
    return;
  }

  if (currentPopupItem.uid === user.uid) {
    showToast("You can't check your own item.");
    checkItemBtn.disabled = false;
    return;
  }

  try {
    // ✅ Check if a notification from this user for this item already exists
    const q = query(
      collection(db, "notifications"),
      where("to", "==", currentPopupItem.uid),
      where("from", "==", user.uid),
      where("itemId", "==", currentPopupItem.id)
    );

    const existing = await getDocs(q);

    if (!existing.empty) {
      showToast("You already sent a notification for this item.");
      return;
    }

    // ✅ Create new notification
    await addDoc(collection(db, "notifications"), {
      to: currentPopupItem.uid,
      from: user.uid,
      itemId: currentPopupItem.id,
      message: `${user.displayName || "Someone"} is interested in the item "${currentPopupItem.title}".`,
      timestamp: Date.now(),
      read: false
    });

    showToast("Notification sent.");
    document.getElementById("itemPopup").style.display = "none";
  } catch (err) {
    console.error("Failed to send notification:", err);
    showToast("Failed to send notification.");
  }
});




const notificationBtn = document.getElementById("notificationBtn");
const notificationPopup = document.getElementById("notificationPopup");

notificationBtn.addEventListener("click", () => {
  const isVisible = notificationPopup.style.display === "block";
  notificationPopup.style.display = isVisible ? "none" : "block";

  // Lazy-load notifications only once
  if (!notificationsLoaded && auth.currentUser) {
  listenToNotifications(auth.currentUser.uid);
  notificationsLoaded = true;
}

});


function loadNotifications(userId) {
  const q = query(
  collection(db, "notifications"),
  where("to", "==", userId),
  orderBy("timestamp", "desc")
);

  getDocs(q).then(snapshot => {
    notificationPopup.innerHTML = "";

    if (snapshot.empty) {
      notificationPopup.innerHTML = "<div class='notification-item'>No notifications</div>";
      return;
    }

    snapshot.forEach((doc) => {
      const notif = doc.data();
      const div = document.createElement("div");
      div.className = "notification-item";
      div.textContent = notif.message;

      div.addEventListener("click", () => {
        showToast("Notification clicked:\n" + notif.message);
        notificationPopup.style.display = "none";
      });

      notificationPopup.appendChild(div);
    });
  });
}


function listenToNotifications(userId) {
  const q = query(
  collection(db, "notifications"),
  where("to", "==", userId),
  orderBy("timestamp", "desc")
);

  onSnapshot(q, (snapshot) => {
    notificationPopup.innerHTML = "";

    if (snapshot.empty) {
      notificationPopup.innerHTML = "<div class='notification-item'>No notifications</div>";
      document.getElementById("notificationCount").style.display = "none";
      return;
    }

    let unreadCount = 0;

    snapshot.forEach((doc) => {
      const notif = doc.data();
      const div = document.createElement("div");
      div.className = "notification-item" + (notif.read ? "" : " unread");
      div.textContent = notif.message;

      if (!notif.read) unreadCount++;

      div.addEventListener("click", async () => {
        await setDoc(doc.ref, { ...notif, read: true });
        showToast("Notification clicked:\n" + notif.message);
        notificationPopup.style.display = "none";
      });

      notificationPopup.appendChild(div);
    });

    const badge = document.getElementById("notificationCount");
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? "inline-block" : "none";
  });
}


document.addEventListener("click", (event) => {
  const popup = document.getElementById("notificationPopup");
  const bell = document.getElementById("notificationBtn");

  if (!popup.contains(event.target) && event.target !== bell) {
    popup.style.display = "none";
  }
});

function showCustomAlert(message) {
  const modal = document.getElementById("customAlertModal");
  const msgBox = document.getElementById("customAlertMessage");
  const closeBtn = document.getElementById("customAlertClose");

  msgBox.textContent = message;
  modal.style.display = "flex";

  closeBtn.onclick = () => {
    modal.style.display = "none";
  };
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById("toastNotification");
  toast.textContent = message;
  toast.style.display = "block";
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "none";
    }, 500); // Wait for animation to fade out
  }, duration);
}
