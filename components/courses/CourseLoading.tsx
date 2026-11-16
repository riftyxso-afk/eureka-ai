export function CourseLoading({ generating = false }: { generating?: boolean }) {
  return <section className="course-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="course-loading-heading"><span className="course-loading-orbit" aria-hidden="true" /><div><h2>{generating ? "Momo sedang menyiapkan pelajaranmu" : "Menyiapkan ruang kursus"}</h2><p>{generating ? "Menyusun penjelasan, contoh, dan latihan sesuai silabus. Kamu bisa kembali; materi yang selesai tetap tersimpan." : "Mengambil silabus, materi, dan progres belajarmu."}</p></div></div>
    <div className="course-loading-paper" aria-hidden="true"><i /><i /><i /><div><i /><i /><i /></div><i /><i /></div>
  </section>;
}
