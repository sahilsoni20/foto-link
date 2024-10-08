import { useCallback, useEffect, useState } from "react";
import { useUploadStore } from "../../hooks/useUploadStore";
import toast from "react-hot-toast";
import { useDropzone } from "react-dropzone";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  firebaseFirestore,
  firebaseStorage,
} from "../../firebase/firebaseConfig";
import { addDoc, collection } from "firebase/firestore";
import { IoCloudUploadOutline } from "react-icons/io5";
import { v4 as uuidv4 } from "uuid";
import {
  Button,
  Copy,
  Data,
  DataInt,
  Id,
  ImgName,
  UploadContainer,
  UploadFun,
  Url,
} from "./Style";
import { GoCopy } from "react-icons/go";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  User,
} from "firebase/auth";

export default function Upload() {
  const { images, setImages } = useUploadStore();
  const [uploading, setUploading] = useState(false);
  const [uploadedData, setUploadedData] = useState<
    { uniqueId: string; url: string }[]
  >([]);

  const auth = getAuth();

  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      // User's authentication state will persist across reloads or tabs.
      console.log("Auth persistence set to local.");
    })
    .catch((error) => {
      console.error("Failed to set auth persistence: ", error);
    });

  const onDrop = useCallback(
    (acceptedImages: File[]) => {
      if (images.length + acceptedImages.length <= 5) {
        setImages([...images, ...acceptedImages]);
      } else {
        toast.error("You can upload a maximum of 5 images.");
      }
    },
    [images, setImages]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    maxFiles: 5,
    accept: {
      "image/*": [],
    },
    multiple: true,
  });

  const useAuth = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
      });

      return () => unsubscribe();
    }, []);

    return { currentUser };
  };

  const UniqueId = () => {
    return uuidv4().slice(0, 6);
  };

  const { currentUser } = useAuth(); // Get current user

  const handleUpload = async () => {
    if (images.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = images.map((image) => {
        return new Promise<void>((resolve, reject) => {
          const uniqueId = UniqueId();
          console.log("Generated Unique ID: ", uniqueId); // Log unique ID

          const storageRef = ref(
            firebaseStorage,
            `images/${uniqueId}-${image.name}`
          );

          const uploadTask = uploadBytesResumable(storageRef, image);

          uploadTask.on(
            "state_changed",
            () => {},
            (error) => {
              console.error("Error uploading image: ", error);
              toast.error(`Failed to upload ${image.name}`);
              reject(error);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(
                  uploadTask.snapshot.ref
                );
                console.log("Download URL: ", downloadUrl); // Log download URL

                if (currentUser) {
                  const userPath = `users/${currentUser.uid}/images`;
                  await addDoc(collection(firebaseFirestore, userPath), {
                    uniqueId,
                    url: downloadUrl,
                    uploadAt: Date.now(),
                  });
                } else {
                  const generalPath = `publicImages`;
                  await addDoc(collection(firebaseFirestore, generalPath), {
                    uniqueId,
                    url: downloadUrl,
                    uploadAt: Date.now(),
                  });
                }

                toast.success(`${image.name} uploaded successfully`);

                setUploadedData((prevData) => [
                  ...prevData,
                  { uniqueId, url: downloadUrl },
                ]);

                resolve();
              } catch (firestoreError) {
                console.error(
                  "Error adding document to Firestore: ",
                  firestoreError
                );
                reject(firestoreError);
              }
            }
          );
        });
      });

      await Promise.all(uploadPromises);
    } catch (error) {
      console.error("Error during upload: ", error);
      toast.error("Error uploading images");
    } finally {
      setUploading(false);
      setImages([]); // Clear uploaded images
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy text: ", error);
      toast.error("Failed to copy text.");
    }
  };

  return (
    <UploadContainer>
      <UploadFun>
        <div {...getRootProps()} className="upload-area">
          <input {...getInputProps()} />
          <h1>File Upload</h1>
          <IoCloudUploadOutline
            size={120}
            color="#c4a489"
            style={{ marginBottom: "1rem" }}
            className="upload-icon"
          />
          <p>
            Drag & drop or <br /> Click here to upload
          </p>
        </div>
        <Button
          onClick={handleUpload}
          disabled={uploading || images.length === 0}
        >
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </UploadFun>

      <div>
        {images.map((image, index) => (
          <ImgName key={index}>{image.name}</ImgName>
        ))}
      </div>

      <Data>
        {uploadedData.map((data, index) => (
          <DataInt key={index}>
            <Url>
              Link:-{" "}
              <a href={data.url} target="_blank" rel="noopener noreferrer">
                {data.url}
              </a>
              <Copy onClick={() => handleCopy(data.url)}>
                <GoCopy size={12} className="copy-icon" />
              </Copy>
            </Url>
            <Id>
              Unique Code: <code>{data.uniqueId}</code>
              <Copy onClick={() => handleCopy(data.uniqueId)}>
                <GoCopy size={12} className="copy-icon" />
              </Copy>
            </Id>
          </DataInt>
        ))}
      </Data>
    </UploadContainer>
  );
}
